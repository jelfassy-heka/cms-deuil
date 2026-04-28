import { useCallback, useEffect, useState } from 'react'
import * as partnerApi from '../api/partnerApi'

// Charge les données nécessaires à l'écran "Mes codes" partenaire.
// Le nom du partenaire est facultatif (échec silencieux), comportement préservé du lot 1.
export function usePartnerCodes(partnerId) {
  const [codes, setCodes] = useState([])
  const [beneficiaries, setBeneficiaries] = useState([])
  const [partnerName, setPartnerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!partnerId) return undefined
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const [codesData, benefData] = await Promise.all([
          partnerApi.getCodes(partnerId),
          partnerApi.getBeneficiaries(partnerId),
        ])
        if (cancelled) return
        setCodes(codesData)
        setBeneficiaries(benefData)
        setError(null)
        try {
          const p = await partnerApi.getPartner(partnerId)
          if (!cancelled) setPartnerName(p.name)
        } catch { /* nom partenaire optionnel */ }
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [partnerId, tick])

  const refetch = useCallback(() => setTick(t => t + 1), [])

  return {
    codes, beneficiaries, partnerName,
    loading, error, refetch,
    setCodes, setBeneficiaries, // mises à jour optimistes après envoi unitaire / batch / ajout
  }
}
