import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db } from '../config/firebase'

/**
 * FLAG: the address-book Firestore path/schema isn't documented in the phase brief.
 * Using users/{walletAddress}/addressBook/{id} for consistency with the activity log's
 * users/{walletAddress}/... convention. Confirm/adjust this path if the real schema differs.
 */
export interface AddressBookContact {
  id: string
  name: string
  address: string
  chain?: string
}

export function useAddressBook(walletAddress: string | undefined) {
  const [contacts, setContacts] = useState<AddressBookContact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!walletAddress) {
      setContacts([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    // Lowercased — see the matching comment in useActivityLog.ts: Firebase Auth's uid is always
    // lowercase, and this path segment must match request.auth.uid exactly for rules to pass.
    const q = query(collection(db, 'users', walletAddress.toLowerCase(), 'addressBook'), orderBy('name', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setContacts(
          snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AddressBookContact, 'id'>) })),
        )
        setIsLoading(false)
      },
      (err) => {
        setError(err)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [walletAddress])

  return { contacts, isLoading, error }
}
