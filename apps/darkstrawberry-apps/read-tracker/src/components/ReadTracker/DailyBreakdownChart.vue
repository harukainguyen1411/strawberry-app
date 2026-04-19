<template>
  <div class="h-48 sm:h-64">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import type { ReadingSession } from '@/firebase/firestore'
import { format as formatDate, startOfWeek, startOfMonth, startOfYear, eachDayOfInterval } from 'date-fns'

Chart.register(...registerables)

interface Props {
  sessions: ReadingSession[]
  period: 'week' | 'month' | 'year'
}

const props = defineProps<Props>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const chartData = computed(() => {
  const now = new Date()
  let startDate: Date
  
  if (props.period === 'week') {
    startDate = startOfWeek(now)
  } else if (props.period === 'month') {
    startDate = startOfMonth(now)
  } else {
    startDate = startOfYear(now)
  }
  
  const days = eachDayOfInterval({ start: startDate, end: now })
  const sessionsByDate = new Map<string, number>()
  
  props.sessions.forEach(session => {
    if (!session.date) return
    const dateKey = formatDate(session.date.toDate(), 'yyyy-MM-dd')
    const dayDate = new Date(dateKey)
    
    if (dayDate >= startDate && dayDate <= now) {
      sessionsByDate.set(dateKey, (sessionsByDate.get(dateKey) || 0) + (session.duration || 0))
    }
  })
  
  return {
    labels: days.map(d => formatDate(d, props.period === 'year' ? 'MMM d' : 'MMM d')),
    data: days.map(d => {
      const dateKey = formatDate(d, 'yyyy-MM-dd')
      return sessionsByDate.get(dateKey) || 0
    })
  }
})

const getMAWindow = (period: 'week' | 'month' | 'year'): number => {
  if (period === 'week') return 3
  if (period === 'month') return 7
  return 14
}

const calculateMA = (data: number[], window: number): number[] => {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = data.slice(start, i + 1)
    const sum = slice.reduce((a, b) => a + b, 0)
    return Math.round((sum / slice.length) * 10) / 10
  })
}

const createChart = () => {
  if (!chartCanvas.value) return

  if (chartInstance) {
    chartInstance.destroy()
  }

  const data = chartData.value
  const isMobile = window.innerWidth < 640
  const maWindow = getMAWindow(props.period)
  const maData = calculateMA(data.data, maWindow)

  chartInstance = new Chart(chartCanvas.value, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Minutes',
          data: data.data,
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 1,
          barThickness: isMobile ? 'flex' : undefined,
          maxBarThickness: isMobile ? 20 : 40,
          order: 2
        },
        {
          label: `${maWindow}-day MA`,
          data: maData,
          type: 'line',
          borderColor: 'rgb(245, 158, 11)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.4,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: isMobile ? 4 : 5,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: {
              size: isMobile ? 10 : 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const minutes = context.parsed.y ?? 0
              const label = context.dataset.label || ''
              if (minutes === 0 && context.datasetIndex === 0) return `${label}: No reading`
              if (minutes < 60) {
                return `${label}: ${Math.round(minutes)}m`
              }
              const hours = Math.floor(minutes / 60)
              const mins = Math.round(minutes % 60)
              return mins > 0 ? `${label}: ${hours}h ${mins}m` : `${label}: ${hours}h`
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            font: {
              size: isMobile ? 10 : 12
            },
            maxRotation: isMobile ? 45 : 0,
            minRotation: isMobile ? 45 : 0
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: {
              size: isMobile ? 10 : 12
            },
            callback: (value) => {
              const minutes = Number(value)
              if (minutes < 60) {
                return `${minutes}m`
              }
              const hours = Math.floor(minutes / 60)
              return `${hours}h`
            }
          }
        }
      }
    }
  })
}

onMounted(() => {
  createChart()
})

watch(() => chartData.value, () => {
  createChart()
}, { deep: true })

watch(() => props.period, () => {
  createChart()
})
</script>
