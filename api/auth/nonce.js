import { nonceHandler } from '../_lib/authHandler.js'

export default async function handler(req, res) {
  await nonceHandler(req, res)
}
