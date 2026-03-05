import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Department, Team, Report, FinalReport } from '../types'
import * as api from '../api'

export const useReportStore = defineStore('report', () => {
  const departments = ref<Department[]>([])
  const teams = ref<Team[]>([])
  const myReports = ref<Report[]>([])
  const finalReports = ref<FinalReport[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDepartments() {
    try {
      const res = await api.getDepartments()
      departments.value = res.data
    } catch (e: any) {
      error.value = e.message
    }
  }

  async function fetchTeams(departmentId?: number) {
    try {
      const res = await api.getTeams(departmentId)
      teams.value = res.data
    } catch (e: any) {
      error.value = e.message
    }
  }

  async function fetchMyReports(userId?: number) {
    loading.value = true
    try {
      const res = await api.getMyReports(userId)
      myReports.value = res.data
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchAllReports() {
    loading.value = true
    try {
      const res = await api.getAllReports()
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
    departments,
    teams,
    myReports,
    finalReports,
    loading,
    error,
    fetchDepartments,
    fetchTeams,
    fetchMyReports,
    fetchAllReports,
    fetchFinalReports,
  }
})
