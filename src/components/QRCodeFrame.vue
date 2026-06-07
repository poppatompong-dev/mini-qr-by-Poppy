<script setup lang="ts">
interface FrameStyle {
  textColor?: string
  backgroundColor?: string
  borderColor?: string
  borderWidth?: string
  borderRadius?: string
  padding?: string
  fontFamily?: string
  /** Frame background image (data:image URI or http(s) URL). Drawn over backgroundColor. */
  backgroundImage?: string
}

interface Props {
  frameText: string
  textPosition: 'top' | 'bottom' | 'left' | 'right'
  frameStyle?: FrameStyle
  /** Side captions only: caption column width in px. */
  captionWidth?: number
  frameTextTop?: string
  frameTextBottom?: string
  textColorTop?: string
  textColorBottom?: string
  fontSizeTop?: number
  fontSizeBottom?: number
}

withDefaults(defineProps<Props>(), {
  textPosition: 'bottom',
  frameStyle: () => ({}),
  captionWidth: 200,
  frameTextTop: '',
  frameTextBottom: '',
  textColorTop: '',
  textColorBottom: '',
  fontSizeTop: 18,
  fontSizeBottom: 18
})

const PREVIEW_QRCODE_DIM_UNIT = 200
</script>

<template>
  <div
    :class="[
      'w-fit',
      (frameTextTop || frameTextBottom)
        ? 'flex-col'
        : (textPosition === 'left' || textPosition === 'right' ? 'flex-row' : 'flex-col'),
      {
        'flex-row-reverse': !(frameTextTop || frameTextBottom) && textPosition === 'left',
        'flex-col-reverse': !(frameTextTop || frameTextBottom) && textPosition === 'top'
      }
    ]"
    :style="{
      backgroundColor: frameStyle.backgroundColor,
      backgroundImage: frameStyle.backgroundImage
        ? `url(${frameStyle.backgroundImage})`
        : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      borderColor: frameStyle.borderColor,
      borderWidth: frameStyle.borderWidth,
      borderRadius: frameStyle.borderRadius,
      padding: frameStyle.padding,
      borderStyle: frameStyle.borderColor ? 'solid' : 'none',
      gap: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }"
  >
    <!-- Top Text if active -->
    <p
      v-if="(frameTextTop || frameTextBottom) ? frameTextTop : (textPosition === 'top' && frameText)"
      :style="{
        color: (frameTextTop || frameTextBottom) ? (textColorTop || frameStyle.textColor) : frameStyle.textColor,
        fontFamily: frameStyle.fontFamily || undefined,
        fontSize: (frameTextTop || frameTextBottom) ? `${fontSizeTop}px` : undefined,
        margin: 0,
        textAlign: 'center',
        maxWidth: `${PREVIEW_QRCODE_DIM_UNIT}px`,
        whiteSpace: 'pre-line'
      }"
    >
      {{ (frameTextTop || frameTextBottom) ? frameTextTop : frameText }}
    </p>

    <!-- Side Text if active (left/right only) -->
    <p
      v-if="!(frameTextTop || frameTextBottom) && (textPosition === 'left' || textPosition === 'right')"
      :style="{
        color: frameStyle.textColor,
        fontFamily: frameStyle.fontFamily || undefined,
        margin: 0,
        textAlign: 'center',
        width: `${captionWidth}px`,
        whiteSpace: 'pre-line'
      }"
    >
      {{ frameText }}
    </p>

    <slot name="qr-code"></slot>

    <!-- Bottom Text if active -->
    <p
      v-if="(frameTextTop || frameTextBottom) ? frameTextBottom : (textPosition === 'bottom' && frameText)"
      :style="{
        color: (frameTextTop || frameTextBottom) ? (textColorBottom || frameStyle.textColor) : frameStyle.textColor,
        fontFamily: frameStyle.fontFamily || undefined,
        fontSize: (frameTextTop || frameTextBottom) ? `${fontSizeBottom}px` : undefined,
        margin: 0,
        textAlign: 'center',
        maxWidth: `${PREVIEW_QRCODE_DIM_UNIT}px`,
        whiteSpace: 'pre-line'
      }"
    >
      {{ (frameTextTop || frameTextBottom) ? frameTextBottom : frameText }}
    </p>
  </div>
</template>
