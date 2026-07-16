import { circleHandler } from '../_lib/circleHandler.js'

export default async function handler(req, res) {
  const rawPath = req.query?.path
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '')
  await circleHandler(req, res, path)
}
