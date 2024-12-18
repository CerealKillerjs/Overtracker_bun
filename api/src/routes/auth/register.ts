import { Elysia, t } from 'elysia'
import { db } from '../../db'
import { users } from '../../db/schema/users'
import { eq, or } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import type { RegisterRoute } from '../../types/elysia-route-types'
import { userSchema, errorSchema } from '../../types/swagger-schemas'
import { generateUniquePasskey, isValidPasskey } from '../../utils/passkey'

export const register = new Elysia()
  .post('/register', async ({ body, set }: RegisterRoute) => {
    const { username, email, password } = body

    try {
      // Verificar si el usuario ya existe
      const existingUser = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.username, username),
            eq(users.email, email)
          )
        )
        .limit(1)

      if (existingUser.length > 0) {
        set.status = 400
        return {
          success: false,
          message: 'El usuario o email ya existe'
        }
      }

      // Generar hash de la contraseña
      const salt = await bcrypt.genSalt(10)
      const password_hash = await bcrypt.hash(password, salt)

      // Generar passkey único
      const passkey = await generateUniquePasskey()
      
      if (!isValidPasskey(passkey)) {
        set.status = 500
        return {
          success: false,
          message: 'Error al generar el passkey'
        }
      }

      // Insertar nuevo usuario
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          email,
          password_hash,
          passkey,
          role: 'user',
          verified: false,
          last_login: null
        })
        .returning({
          id: users.id,
          username: users.username,
          email: users.email,
          passkey: users.passkey,
          role: users.role,
          verified: users.verified,
          created_at: users.created_at
        })

      return {
        success: true,
        message: 'Usuario registrado correctamente',
        user: newUser
      }

    } catch (error) {
      console.error('Error al registrar usuario:', error)
      set.status = 500
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error al registrar usuario'
      }
    }
  }, {
    body: t.Object({
      username: t.String({ minLength: 3, maxLength: 50 }),
      email: t.String({ format: 'email' }),
      password: t.String({ minLength: 6 })
    }),
    detail: {
      tags: ['Auth'],
      summary: 'Registrar un nuevo usuario',
      description: 'Crea una nueva cuenta de usuario en el sistema',
      responses: {
        200: {
          description: 'Usuario registrado correctamente',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', default: true },
                  message: { type: 'string' },
                  user: userSchema
                }
              }
            }
          }
        },
        400: {
          description: 'Datos de registro inválidos',
          content: {
            'application/json': {
              schema: errorSchema
            }
          }
        },
        500: {
          description: 'Error del servidor',
          content: {
            'application/json': {
              schema: errorSchema
            }
          }
        }
      }
    }
  }) 