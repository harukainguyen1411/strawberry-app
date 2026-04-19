<template>
  <div class="h-56 sm:h-72">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Chart, registerables } from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'

Chart.register(...registerables, annotationPlugin)

interface Props {
  data: {
    labels: string[]
    data: number[]
  }
  goalTarget: number | null
}

const props = defineProps<Props>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

const createChart = () => {
  if (!chartCanvas.value) return

  if (chartInstance) {
    chartInstance.destroy()
  }

  const isMobile = window.innerWidth < 640
  const goal = props.goalTarget

  // Color bars based on whether they meet the goal
  const barColors = props.data.data.map(value => {
    if (!goal) return 'rgba(99, 102, 241, 0.6)'
    return value >= goal ? 'rgba(34, 197, 94, 0.6)' : 'rgba(99, 102, 241, 0.6)'
  })

  const barBorderColors = props.data.data.map(value => {
    if (!goal) return 'rgb(99, 102, 241)'
    return value >= goal ? 'rgb(34, 197, 94)' : 'rgb(99, 102, 241)'
  })

  // Build annotation config for goal line
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annotationConfig: Record<string, any> = {}
  if (goal) {
    annotationConfig.goalLine = {
      type: 'line' as const,
      yMin: goal,
      yMax: goal,
      borderColor: 'rgb(239, 68, 68)',
      borderWidth: 2,
      borderDash: [6, 4],
      label: {
        display: true,
        content: `${formatDuration(goal)}`,
        position: 'end' as const,
        backgroundColor: 'rgb(239, 68, 68)',
        color: 'white',
        font: {
          size: isMobile ? 10 : 12,
          weight: 'bold' as const
        },
        padding: { top: 2, bottom: 2, left: 6, right: 6 },
        borderRadius: 4
      }
    }
  }

  chartInstance = new Chart(chartCanvas.value, {
    type: 'bar',
    data: {
      labels: props.data.labels,
      datasets: [
        {
          label: 'Avg Daily Reading',
          data: props.data.data,
          backgroundColor: barColors,
          borderColor: barBorderColors,
          borderWidth: 1,
          barThickness: isMobile ? 'flex' : undefined,
          maxBarThickness: isMobile ? 24 : 48,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        annotation: {
          annotations: annotationConfig
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const minutes = context.parsed.y ?? 0
              if (minutes === 0) return 'No reading'
              return formatDuration(minutes)
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

watch(() => props.goalTarget, () => {
  createChart()
})
</script>
