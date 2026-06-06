export function calculateCRC16(data: string): string {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i)
    crc ^= charCode << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function generatePromptPayPayload(target: string, amount?: number): string {
  // Sanitize target (keep only digits)
  const cleanTarget = target.replace(/\D/g, '')

  let formattedTarget = ''
  let targetType = '01' // default 01 for mobile

  if (cleanTarget.length === 10 && cleanTarget.startsWith('0')) {
    // Mobile number format: 0066 + 9 digits of mobile number (total 13 digits)
    formattedTarget = '0066' + cleanTarget.substring(1)
    targetType = '01'
  } else if (cleanTarget.length === 13) {
    // National ID format (13 digits)
    formattedTarget = cleanTarget
    targetType = '02'
  } else {
    // Fallback/raw target
    formattedTarget = cleanTarget.padEnd(13, '0').substring(0, 13)
  }

  const merchantInfoTag = '29'
  const aid = 'A000000677010111' // PromptPay AID
  const aidSegment = '0016' + aid

  const targetSegment = targetType + String(formattedTarget.length).padStart(2, '0') + formattedTarget

  const merchantInfoValue = aidSegment + targetSegment
  const merchantInfoLength = String(merchantInfoValue.length).padStart(2, '0')
  const merchantInfo = merchantInfoTag + merchantInfoLength + merchantInfoValue

  let payload = '000201' + '010211' + merchantInfo + '5802TH' + '5303764'

  if (amount !== undefined && amount > 0) {
    const amountStr = amount.toFixed(2)
    payload += '54' + String(amountStr.length).padStart(2, '0') + amountStr
  }

  payload += '6304'

  const crc = calculateCRC16(payload)
  return payload + crc
}
