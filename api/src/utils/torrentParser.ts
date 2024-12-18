import bencode from 'bencode'
import crypto from 'crypto'

interface ParsedTorrent {
  infoHash: string
  infoHashV2?: string
  version: 'v1' | 'v2' | 'hybrid'
  size: bigint
  files: {
    path: string
    size: bigint
  }[]
  pieceLength: number
}

export async function parseTorrent(torrentBase64: string): Promise<{ 
  success: boolean
  message?: string
  data?: ParsedTorrent 
}> {
  try {
    const torrentBuffer = Buffer.from(torrentBase64, 'base64')
    const decoded = bencode.decode(torrentBuffer)
    const info = decoded.info

    // Calcular info_hash (v1)
    const infoBuffer = bencode.encode(info)
    const infoHash = crypto.createHash('sha1').update(infoBuffer).digest('hex')

    // Detectar versión y calcular info_hash_v2 si es necesario
    let version: 'v1' | 'v2' | 'hybrid' = 'v1'
    let infoHashV2: string | undefined

    if (info.file_tree) {
      version = info.pieces ? 'hybrid' : 'v2'
      // Calcular info_hash_v2 para v2/hybrid
      infoHashV2 = crypto.createHash('sha256').update(infoBuffer).digest('hex')
    }

    // Procesar archivos
    let files: { path: string; size: bigint }[] = []
    let totalSize = BigInt(0)

    if (info.files) {
      // Multi-archivo
      files = info.files.map((file: any) => ({
        path: Array.isArray(file.path) ? file.path.join('/') : file.path,
        size: BigInt(file.length)
      }))
      totalSize = files.reduce((acc, file) => acc + file.size, BigInt(0))
    } else {
      // Archivo único
      files = [{
        path: info.name.toString(),
        size: BigInt(info.length)
      }]
      totalSize = BigInt(info.length)
    }

    return {
      success: true,
      data: {
        infoHash,
        infoHashV2,
        version,
        size: totalSize,
        files,
        pieceLength: info.piece_length
      }
    }

  } catch (error) {
    console.error('Error parsing torrent:', error)
    return {
      success: false,
      message: 'Error al parsear el archivo torrent'
    }
  }
} 