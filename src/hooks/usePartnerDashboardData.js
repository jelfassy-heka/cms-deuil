import { useCallback, useEffect, useState } from 'react'
import * as partnerApi from '../api/partnerApi'

// Charge le bundle de données nécessaire au Dashboard partenaire.
// Pas de cache, pas de retry — on reproduit le comportement historique
// (un Promise.all unique au montage, refetch manuel possible).
export function usePartnerDashboardData(partnerId) {
  const [codes, setCodes] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [contract, setContract] = useState(null)
  const [requests, setRequests] = useState([])
  const [partnerInfo, setPartnerInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!partnerId) return undefined
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const [codesData, contractsData, requestsData, partnerData, benefData] = await Promise.all([
          partnerApi.getCodes(partnerId),
          partnerApi.getContracts(partnerId),
          partnerApi.getRequests(partnerId),
          partnerApi.getPartner(partnerId),
          partnerApi.getBeneficiaries(partnerId),
        ])
        if (cancelled) return
        setCodes(codesData)
        setContract(contractsData[0] || null)
        setRequests(requestsData)
        setPartnerInfo(partnerData)
        setBeneficiaries(benefData)
        setError(null)
      } catch (err) {
        if (cancelled) return
        console.error('Erreur:', err)
        setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [partnerId, tick])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return {
    codes, beneficiaries, contract, requests, partnerInfo,
    loading, error, refetch,
    setRequests, // utilisé pour préserver l'optimistic update lors de la création d'une demande
  }
}
