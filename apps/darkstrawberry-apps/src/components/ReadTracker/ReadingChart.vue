<template>
  <div class="h-48 sm:h-64">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

interface Props {
  data: {
    labels: string[]
    data: number[]
  }
  period: 'week' | 'month' | 'year'
}

const props = defineProps<Props>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

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

  const isMobile = window.innerWidth < 640
  const maWindow = getMAWindow(props.period)
  const maData = calculateMA(props.data.data, maWindow)

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels: props.data.labels,
      datasets: [
        {
          label: 'Reading Time',
          data: props.data.data,
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: isMobile ? 3 : 4,
          pointHoverRadius: isMobile ? 5 : 6
        },
        {
          label: `${maWindow}-day MA`,
          data: maData,
          borderColor: 'rgb(245, 158, 11)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.4,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: isMobile ? 4 : 5
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

watch(() => props.data, () => {
  createChart()
}, { deep: true })

watch(() => props.period, () => {
  createChart()
})
</script>
