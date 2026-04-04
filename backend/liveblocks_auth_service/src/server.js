import cors from "cors"
import "dotenv/config"
import express from "express"
import { jwtVerify, createRemoteJWKSet } from "jose"
import { Liveblocks } from "@liveblocks/node"

const port = Number(process.env.PORT || 8787)
const supabaseUrl = process.env.SUPABASE_URL
const liveblocksSecretKey = process.env.LIVEBLOCKS_SECRET_KEY

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is required")
}

if (!liveblocksSecretKey) {
  throw new Error("LIVEBLOCKS_SECRET_KEY is required")
}

const app = express()
const liveblocks = new Liveblocks({ secret: liveblocksSecretKey })
const supabaseJwks = createRemoteJWKSet(
  new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`)
)

app.use(cors())
app.use(express.json())

app.post("/auth/liveblocks", async (req, res) => {
  try {
    const user = await getUser(req)
    const response = await liveblocks.identifyUser(
      { userId: user.id },
      {
        userInfo: {
          name: formatUserName(user.email),
        },
      }
    )

    return res.status(response.status).send(response.body)
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      error: error.message || "Liveblocks authorization failed",
    })
  }
})

app.listen(port, () => {
  console.log(`Liveblocks auth service listening on http://127.0.0.1:${port}`)
})

async function getUser(req) {
  const authorizationHeader = req.headers.authorization

  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw createHttpError(401, "Missing bearer token")
  }

  const token = authorizationHeader.slice("Bearer ".length).trim()
  const { payload } = await jwtVerify(token, supabaseJwks, {
    audience: "authenticated",
  })
  const userId = payload.sub
  const email = typeof payload.email === "string" ? payload.email : ""

  if (!userId) {
    throw createHttpError(401, "Invalid token payload")
  }

  return { id: userId, email }
}

function formatUserName(email) {
  if (!email.trim()) {
    return "Anonymous"
  }

  const [localPart] = email.split("@")
  const displayName = localPart
    .replace(/[._-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")

  return displayName || email
}

function createHttpError(statusCode, message) {
  const error = new Error(message)
  error.statusCode = statusCode

  return error
}
