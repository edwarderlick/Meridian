import { verifyHandler } from '../_lib/authHandler.js'

export default async function handler(req, res) {
  await verifyHandler(req, res)
}
