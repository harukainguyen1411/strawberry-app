#!/usr/bin/env python3
"""
comments.py — OOXML comment injector for Bee worker.

Usage:
    python comments.py <input.docx> <comments.json> <output.docx>
    python comments.py <input.docx> - <output.docx>   # read JSON from stdin

JSON format:
    [
      {
        "quote":      "exact or approximate text to anchor the comment on",
        "comment":    "comment body text",
        "source_url": "https://..."
      },
      ...
    ]

Each comment is inserted as a Word OOXML w:comment element anchored to the
matched run range. If the quote spans multiple runs the outer runs are split
so the anchor is exact. Falls back to fuzzy matching (longest common
subsequence ratio) when the quote is not found verbatim.

Vietnamese font fix: every comment run uses Times New Roman with
xml:space="preserve" so diacritics survive round-trips through Word.
"""

from __future__ import annotations

import argparse
import copy
import json
import re
import sys
import unicodedata
from difflib import SequenceMatcher
from typing import Optional

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from lxml import etree


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{WORD_NS}}}"

COMMENT_FONT = "Times New Roman"
COMMENT_FONT_SIZE = "20"  # half-points → 10 pt body; adjust if desired

FUZZY_THRESHOLD = 0.6  # minimum similarity ratio to accept a fuzzy match


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    """Collapse whitespace and normalize unicode for comparison."""
    text = unicodedata.normalize("NFC", text)
    return re.sub(r"\s+", " ", text).strip()


def _para_text(para) -> str:
    """Full plain text of a paragraph (no whitespace collapse)."""
    return "".join(run.text for run in para.runs)


def _all_paragraphs(doc: Document):
    """Yield every paragraph in the document body (including in tables)."""
    body = doc.element.body
    yield from _walk_paragraphs(body)


def _walk_paragraphs(element):
    from docx.oxml.ns import qn as _qn
    for child in element:
        tag = child.tag
        if tag == W + "p":
            from docx.text.paragraph import Paragraph
            yield Paragraph(child, None)
        elif tag in (W + "tbl", W + "tr", W + "tc"):
            yield from _walk_paragraphs(child)
        elif tag == W + "body":
            yield from _walk_paragraphs(child)


# ---------------------------------------------------------------------------
# Run-splitting
# ---------------------------------------------------------------------------

def _split_run_at(run, offset: int):
    """
    Split *run* at *offset* characters.
    Returns (left_run, right_run) where left_run contains text[:offset]
    and right_run contains text[offset:].  right_run is inserted after
    left_run in the XML tree.  Copies run properties to both halves.
    """
    text = run.text
    left_text = text[:offset]
    right_text = text[offset:]

    run.text = left_text

    # Clone the run element for the right half
    right_elem = copy.deepcopy(run._element)
    # Set text in the clone
    r_t = right_elem.find(W + "t")
    if r_t is None:
        r_t = OxmlElement("w:t")
        right_elem.append(r_t)
    r_t.text = right_text
    if right_text and (right_text[0] == " " or right_text[-1] == " "):
        r_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

    # Fix left run whitespace preservation
    l_t = run._element.find(W + "t")
    if l_t is not None and left_text and (left_text[0] == " " or left_text[-1] == " "):
        l_t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")

    # Insert after the current run element
    run._element.addnext(right_elem)

    from docx.text.run import Run
    right_run = Run(right_elem, run._parent)
    return run, right_run


# ---------------------------------------------------------------------------
# Locating a quote inside the document
# ---------------------------------------------------------------------------

class _Match:
    """Describes where a quote was found."""
    def __init__(self, para, start_run_idx: int, start_char: int,
                 end_run_idx: int, end_char: int):
        self.para = para
        self.start_run_idx = start_run_idx
        self.start_char = start_char
        self.end_run_idx = end_run_idx
        self.end_char = end_char


def _find_exact(para, quote: str) -> Optional[_Match]:
    """
    Search for *quote* inside *para* by reconstructing the paragraph text
    and mapping character offsets back to (run_index, char_within_run).
    """
    runs = para.runs
    if not runs:
        return None

    # Build character → (run_idx, char_in_run) map
    char_map: list[tuple[int, int]] = []
    for ri, run in enumerate(runs):
        for ci, _ in enumerate(run.text):
            char_map.append((ri, ci))

    full_text = _para_text(para)
    norm_full = _normalize(full_text)
    norm_quote = _normalize(quote)

    idx = norm_full.find(norm_quote)
    if idx == -1:
        return None

    # The normalized version may have collapsed whitespace; map back
    # to actual character positions in the raw full_text.
    raw_idx = _raw_index(full_text, norm_quote, idx)
    if raw_idx is None:
        return None

    end_raw = raw_idx + len(quote)  # approximate end

    # Clamp to available char_map
    if raw_idx >= len(char_map) or end_raw > len(char_map):
        return None

    sr, sc = char_map[raw_idx]
    er, ec = char_map[min(end_raw, len(char_map)) - 1]
    return _Match(para, sr, sc, er, ec + 1)


def _raw_index(full_text: str, norm_quote: str, norm_idx: int) -> Optional[int]:
    """
    Given the normalized-string index, find the corresponding index in
    full_text (which has not been whitespace-collapsed).
    Walk both strings in parallel.
    """
    ni = 0   # index into normalized reconstruction
    fi = 0   # index into full_text
    norm_fi = 0

    norm_full = _normalize(full_text)

    # We need to find position in full_text where norm reconstruction == norm_idx
    # Simple approach: re-normalize character by character tracking.
    fi = 0
    accumulated = ""
    while fi < len(full_text):
        ch = full_text[fi]
        accumulated += ch
        norm_accumulated = _normalize(accumulated)
        if len(norm_accumulated) == norm_idx:
            return fi + 1
        if len(norm_accumulated) > norm_idx:
            return fi - (len(norm_accumulated) - norm_idx) + 1
        fi += 1
    return None


def _find_fuzzy(para, quote: str) -> Optional[_Match]:
    """Fuzzy fallback: find the paragraph whose text most resembles *quote*."""
    full_text = _para_text(para)
    norm_full = _normalize(full_text)
    norm_quote = _normalize(quote)

    ratio = SequenceMatcher(None, norm_quote, norm_full).ratio()
    if ratio < FUZZY_THRESHOLD:
        return None

    # Anchor the comment to the entire paragraph (first→last run)
    runs = para.runs
    if not runs:
        return None
    return _Match(para, 0, 0, len(runs) - 1, len(runs[-1].text))


def locate_quote(doc: Document, quote: str) -> Optional[_Match]:
    """
    Scan all paragraphs for the quote.  Try exact first, then fuzzy
    across all paragraphs, returning the best fuzzy match.
    """
    norm_quote = _normalize(quote)
    best_ratio = 0.0
    best_match: Optional[_Match] = None

    for para in _all_paragraphs(doc):
        # Exact match
        m = _find_exact(para, quote)
        if m is not None:
            return m

        # Track best fuzzy candidate
        full_text = _para_text(para)
        if not full_text.strip():
            continue
        ratio = SequenceMatcher(None, norm_quote, _normalize(full_text)).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = para  # save paragraph for fuzzy

    if best_ratio >= FUZZY_THRESHOLD and best_match is not None:
        return _find_fuzzy(best_match, quote)

    return None


# ---------------------------------------------------------------------------
# OOXML comment element construction
# ---------------------------------------------------------------------------

def _make_comment_element(comment_id: int, author: str, date: str,
                           body_text: str, source_url: str) -> etree._Element:
    """
    Build a <w:comment> element with id, author, date, and body text.
    Body text = comment + newline + source URL.
    Uses Times New Roman + xml:space=preserve for Vietnamese safety.
    """
    comment = OxmlElement("w:comment")
    comment.set(qn("w:id"), str(comment_id))
    comment.set(qn("w:author"), author)
    comment.set(qn("w:date"), date)

    # Paragraph inside the comment
    cp = OxmlElement("w:p")

    # Comment paragraph properties (optional — just id reference)
    cpp = OxmlElement("w:pPr")
    rpr_style = OxmlElement("w:pStyle")
    rpr_style.set(qn("w:val"), "CommentText")
    cpp.append(rpr_style)
    cp.append(cpp)

    # Run with the comment body
    full_body = f"{body_text}\nNguồn: {source_url}"
    for line in full_body.splitlines():
        cr = OxmlElement("w:r")

        rpr = OxmlElement("w:rPr")
        rfonts = OxmlElement("w:rFonts")
        rfonts.set(qn("w:ascii"), COMMENT_FONT)
        rfonts.set(qn("w:hAnsi"), COMMENT_FONT)
        rfonts.set(qn("w:cs"), COMMENT_FONT)
        rpr.append(rfonts)
        sz = OxmlElement("w:sz")
        sz.set(qn("w:val"), COMMENT_FONT_SIZE)
        rpr.append(sz)
        szCs = OxmlElement("w:szCs")
        szCs.set(qn("w:val"), COMMENT_FONT_SIZE)
        rpr.append(szCs)
        cr.append(rpr)

        ct = OxmlElement("w:t")
        ct.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        ct.text = line
        cr.append(ct)
        cp.append(cr)

    comment.append(cp)
    return comment


def _ensure_comments_part(doc: Document):
    """
    Ensure the document has a w:comments part.  Returns the <w:comments>
    element.  Creates the relationship + part if absent.
    """
    # Check if already present
    part = doc.part
    try:
        comments_part = part.part_related_by(
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments"
        )
        return comments_part._element
    except KeyError:
        pass

    # Create the comments XML
    comments_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:comments xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"'
        ' xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"'
        ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
        ' xmlns:aink="http://schemas.microsoft.com/office/drawing/2016/ink"'
        ' xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d"'
        ' xmlns:o="urn:schemas-microsoft-com:office:office"'
        ' xmlns:oel="http://schemas.microsoft.com/office/2019/extlst"'
        ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
        ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'
        ' xmlns:v="urn:schemas-microsoft-com:vml"'
        ' xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"'
        ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
        ' xmlns:w10="urn:schemas-microsoft-com:office:word"'
        ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
        ' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"'
        ' xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"'
        ' xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex"'
        ' xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid"'
        ' xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml"'
        ' xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash"'
        ' xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex"'
        ' xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"'
        ' xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"'
        ' xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"'
        ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"'
        ' mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh wp14">'
        '</w:comments>'
    )

    from docx.opc.part import Part
    from docx.opc.packuri import PackURI
    from docx.opc.constants import RELATIONSHIP_TYPE as RT

    content_type = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"
    )
    partname = PackURI("/word/comments.xml")
    comments_part_obj = Part(partname, content_type, comments_xml.encode("utf-8"), part.package)
    rel = part.relate_to(
        comments_part_obj,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments",
    )
    return etree.fromstring(comments_xml.encode("utf-8"))


def _get_or_create_comments_element(doc: Document):
    """
    Returns the lxml <w:comments> element, creating the part if needed.
    After calling this, comments_elem is directly in the document package.
    """
    part = doc.part
    try:
        rel = part.part_related_by(
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments"
        )
        return rel._element
    except (KeyError, AttributeError):
        pass

    # We need to create it from scratch and wire it into the package.
    # python-docx does not expose a high-level API for this, so we use
    # the internal Part machinery.
    from io import BytesIO
    from docx.opc.part import Part
    from docx.opc.packuri import PackURI

    comments_xml = b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:comments>'

    content_type = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"
    )
    partname = PackURI("/word/comments.xml")
    blob = comments_xml
    new_part = Part(partname, content_type, blob, part.package)
    part.relate_to(
        new_part,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments",
    )
    return new_part._element


# ---------------------------------------------------------------------------
# Anchor injection
# ---------------------------------------------------------------------------

def _insert_comment_anchors(match: _Match, comment_id: int):
    """
    Wrap the matched run range with w:commentRangeStart / w:commentRangeEnd
    bookmarks and append a w:r containing w:commentReference at the end.

    If the match starts/ends in the middle of a run, the run is split first.
    """
    para = match.para
    runs = para.runs  # live list from paragraph XML

    start_ri = match.start_run_idx
    start_ci = match.start_char
    end_ri = match.end_run_idx
    end_ci = match.end_char  # exclusive

    # Split end run first (so indices remain valid)
    end_run = runs[end_ri]
    if end_ci < len(end_run.text):
        _, _ = _split_run_at(end_run, end_ci)
        # After split, the run at end_ri is the correct "anchor end" run
        # (no index change needed)

    # Split start run
    start_run = para.runs[start_ri]  # re-fetch after possible split above
    if start_ci > 0:
        _, right = _split_run_at(start_run, start_ci)
        start_ri += 1  # actual start is now the next run

    # Re-fetch runs after splits
    runs = para.runs

    # Build anchor elements
    range_start = OxmlElement("w:commentRangeStart")
    range_start.set(qn("w:id"), str(comment_id))

    range_end = OxmlElement("w:commentRangeEnd")
    range_end.set(qn("w:id"), str(comment_id))

    ref_run = OxmlElement("w:r")
    ref = OxmlElement("w:commentReference")
    ref.set(qn("w:id"), str(comment_id))
    ref_run.append(ref)

    # Insert range_start before runs[start_ri]
    start_elem = runs[start_ri]._element
    start_elem.addprevious(range_start)

    # Insert range_end after runs[end_ri]
    end_elem = runs[end_ri]._element
    end_elem.addnext(ref_run)
    end_elem.addnext(range_end)


# ---------------------------------------------------------------------------
# Main injection pipeline
# ---------------------------------------------------------------------------

def inject_comments(
    input_path: str,
    annotations: list[dict],
    output_path: str,
    author: str = "Bee",
    date: str = "2026-01-01T00:00:00Z",
) -> list[str]:
    """
    Load *input_path*, inject comments from *annotations*, save to
    *output_path*.  Returns a list of warning strings for unmatched quotes.
    """
    doc = Document(input_path)
    warnings: list[str] = []

    # Get or create the comments part element
    # We work directly on doc.part to inject XML
    doc_part = doc.part

    # Build a fresh comments element in memory
    comments_elem = OxmlElement("w:comments")
    comments_elem.set(
        "xmlns:w",
        "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    )
    comments_elem.set(
        "{http://www.w3.org/XML/1998/namespace}space",
        "preserve",
    )

    # Wire comments part into document before modifying runs
    from docx.opc.part import Part
    from docx.opc.packuri import PackURI

    COMMENTS_REL_TYPE = (
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments"
    )
    COMMENTS_CONTENT_TYPE = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"
    )

    # Check if comments part already exists
    existing_comments_elem = None
    try:
        existing_part = doc_part.part_related_by(COMMENTS_REL_TYPE)
        existing_comments_elem = existing_part._element
    except KeyError:
        pass

    if existing_comments_elem is None:
        # Serialize a minimal comments doc and create the Part
        placeholder_xml = (
            b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            b'<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:comments>'
        )
        partname = PackURI("/word/comments.xml")
        new_part = Part(partname, COMMENTS_CONTENT_TYPE, placeholder_xml, doc_part.package)
        doc_part.relate_to(new_part, COMMENTS_REL_TYPE)
        # Replace the new_part._element with our in-memory comments_elem
        # by serializing later
        comments_part = new_part
    else:
        comments_part = doc_part.part_related_by(COMMENTS_REL_TYPE)

    # Process each annotation
    used_ids: set[int] = set()
    comment_id = 0

    for ann in annotations:
        quote = ann.get("quote", "")
        comment_text = ann.get("comment", "")
        source_url = ann.get("source_url", "")

        if not quote or not comment_text:
            warnings.append(f"Skipped annotation with empty quote or comment: {ann!r}")
            continue

        # Find the quote in the document
        match = locate_quote(doc, quote)
        if match is None:
            warnings.append(f"Quote not found (skipped): {quote!r}")
            continue

        # Assign comment ID
        while comment_id in used_ids:
            comment_id += 1
        used_ids.add(comment_id)

        # Build comment element
        comment_elem = _make_comment_element(
            comment_id=comment_id,
            author=author,
            date=date,
            body_text=comment_text,
            source_url=source_url,
        )
        comments_elem.append(comment_elem)

        # Insert anchors into document body
        try:
            _insert_comment_anchors(match, comment_id)
        except Exception as exc:
            warnings.append(f"Anchor injection failed for {quote!r}: {exc}")

        comment_id += 1

    # Serialize comments_elem into the comments_part blob
    comments_xml_bytes = etree.tostring(
        comments_elem,
        xml_declaration=True,
        encoding="UTF-8",
        standalone=True,
    )
    comments_part._blob = comments_xml_bytes

    doc.save(output_path)
    return warnings


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Inject OOXML comments into a .docx file."
    )
    parser.add_argument("input_docx", help="Path to the source .docx file")
    parser.add_argument(
        "json_file",
        help='Path to JSON annotations file, or "-" to read from stdin',
    )
    parser.add_argument("output_docx", help="Path for the output .docx file")
    parser.add_argument(
        "--author",
        default="Bee",
        help="Author name for the comments (default: Bee)",
    )
    parser.add_argument(
        "--date",
        default="2026-01-01T00:00:00Z",
        help="ISO 8601 date string for the comments (default: 2026-01-01T00:00:00Z)",
    )
    args = parser.parse_args()

    # Load annotations
    if args.json_file == "-":
        raw = sys.stdin.read()
    else:
        with open(args.json_file, "r", encoding="utf-8") as fh:
            raw = fh.read()

    try:
        annotations = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"ERROR: Invalid JSON — {exc}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(annotations, list):
        print("ERROR: JSON must be a list of annotation objects", file=sys.stderr)
        sys.exit(1)

    warnings = inject_comments(
        input_path=args.input_docx,
        annotations=annotations,
        output_path=args.output_docx,
        author=args.author,
        date=args.date,
    )

    for w in warnings:
        print(f"WARNING: {w}", file=sys.stderr)

    print(f"OK: wrote {args.output_docx} ({len(annotations) - len(warnings)} comments injected)")
    if warnings:
        sys.exit(2)  # partial success

if __name__ == "__main__":
    main()
