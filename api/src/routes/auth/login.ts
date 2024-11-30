import { Elysia, t } from 'elysia'
import { db } from '../../db'
import { users, refreshTokens } from '../../db/schema/users'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import type { LoginRoute } from '../../types/elysia-route-types'

export const login = new Elysia()
  .post('/login', async ({ body, set, jwt }: LoginRoute) => {
    const { username, password } = body

    try {
      // Buscar usuario por username
      const user = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1)
        .then(rows => rows[0])

      // Si no existe el usuario o la contraseña es incorrecta
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        set.status = 401
        return {
          success: false,
          message: 'Usuario o contraseña incorrectos'
        }
      }

      // Generar access token
      const access_token = await jwt.sign({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified: user.verified
      })

      // Generar refresh token
      const refresh_token = randomUUID()
      const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días

      // Guardar refresh token
      await db
        .insert(refreshTokens)
        .values({
          user_id: user.id,
          token: refresh_token,
          expires_at
        })

      // Actualizar último login
      await db
        .update(users)
        .set({
          last_login: new Date(),
          updated_at: new Date()
        })
        .where(eq(users.id, user.id))

      return {
        success: true,
        message: 'Login correcto',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          verified: user.verified,
          last_login: user.last_login,
          created_at: user.created_at
        },
        access_token,
        refresh_token
      }

    } catch (error) {
      console.error('Error en login:', error)
      set.status = 500
      return {
        success: false,
        message: 'Error al iniciar sesión'
      }
    }
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String()
    })
  }) 