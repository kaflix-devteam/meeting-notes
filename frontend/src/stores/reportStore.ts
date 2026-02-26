import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Team, Report, FinalReport } from '../types'
import * as api from '../api'

export const useReportStore = defineStore('report', () => {
  const teams = ref<Team[]>([])
  const myReports = ref<Report[]>([])
  const finalReports = ref<FinalReport[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTeams() {
    try {
      const res = await api.getTeams()
      teams.value = res.data
    } catch (e: any) {
      error.value = e.message
    }
  }

  async function fetchMyReports() {
    loading.value = true
    try {
      const res = await api.getMyReports()
      myReports.value = res.data
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchFinalReports() {
    loading.value = true
    try {
      const res = await api.getFinalReports()
      finalReports.value = res.data
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  return {
    teams,
    myReports,
    finalReports,
    loading,
    error,
    fetchTeams,
    fetchMyReports,
    fetchFinalReports,
  }
})
