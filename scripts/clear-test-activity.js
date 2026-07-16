// One-off cleanup for test activity accumulated during bridge/transfer testing.
// Run with Node's built-in --env-file flag, same as server/dev-server.js:
//   node --env-file=.env scripts/clear-test-activity.js <walletAddress> --confirm

import { getAdminFirestore } from '../api/_lib/firebaseAdmin.js'

const args = process.argv.slice(2)
const address = args.find((arg) => !arg.startsWith('--'))
const confirmed = args.includes('--confirm')

if (!address || !confirmed) {
  console.error(
    'Usage: node --env-file=.env scripts/clear-test-activity.js <walletAddress> --confirm\n' +
      '  Deletes every document in users/<walletAddress>/transfers. Both the address and --confirm are required.',
  )
  process.exit(1)
}

const walletAddress = address.toLowerCase()
const db = getAdminFirestore()
const transfersRef = db.collection('users').doc(walletAddress).collection('transfers')

const snapshot = await transfersRef.get()
if (snapshot.empty) {
  console.log(`No documents found under users/${walletAddress}/transfers — nothing to delete.`)
  process.exit(0)
}

// Firestore batches cap at 500 writes.
const BATCH_SIZE = 500
let deleted = 0
const docs = snapshot.docs
for (let i = 0; i < docs.length; i += BATCH_SIZE) {
  const batch = db.batch()
  for (const doc of docs.slice(i, i + BATCH_SIZE)) {
    batch.delete(doc.ref)
  }
  await batch.commit()
  deleted += Math.min(BATCH_SIZE, docs.length - i)
}

console.log(`Deleted ${deleted} document(s) from users/${walletAddress}/transfers.`)
