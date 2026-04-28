import { useCallback, useEffect, useState } from 'react'
import * as partnerApi from '../api/partnerApi'

// Charge les données nécessaires à l'écran "Mon équipe" partenaire.
export function usePartnerTeam(partnerId) {
  const [members, setMembers] = useState([])
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
        const [membersData, partnerData] = await Promise.all([
          partnerApi.getMembers(partnerId),
          partnerApi.getPartner(partnerId),
        ])
        if (cancelled) return
        setMembers(membersData)
        setPartnerInfo(partnerData)
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
    members, partnerInfo,
    loading, error, refetch,
    setMembers, // mises à jour optimistes après invitation / changement de rôle / retrait
  }
}
