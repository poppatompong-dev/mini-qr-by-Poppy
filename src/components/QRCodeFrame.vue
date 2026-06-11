<script setup lang="ts">
import { computed } from 'vue'

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
  fontWeightTop?: string
  fontWeightBottom?: string
  fontStyleTop?: string
  fontStyleBottom?: string
  fontFamilyTop?: string
  fontFamilyBottom?: string
}

const props = withDefaults(defineProps<Props>(), {
  textPosition: 'bottom',
  frameStyle: () => ({}),
  captionWidth: 200,
  frameTextTop: '',
  frameTextBottom: '',
  textColorTop: '',
  textColorBottom: '',
  fontSizeTop: 18,
  fontSizeBottom: 18,
  fontWeightTop: 'normal',
  fontWeightBottom: 'normal',
  fontStyleTop: 'normal',
  fontStyleBottom: 'normal',
  fontFamilyTop: '',
  fontFamilyBottom: ''
})

const PREVIEW_QRCODE_DIM_UNIT = 260

const hasTop = computed(() => {
  return !!(props.frameTextTop || (props.textPosition === 'top' && props.frameText))
})

const hasBottom = computed(() => {
  return !!(props.frameTextBottom || (props.textPosition === 'bottom' && props.frameText))
})
</script>

<template>
  <div
    :class="[
      'w-fit',
      (hasTop || hasBottom)
        ? 'flex-col'
        : (textPosition === 'left' || textPosition === 'right' ? 'flex-row' : 'flex-col'),
      {
        'flex-row-reverse': !(hasTop || hasBottom) && textPosition === 'left',
        'flex-col-reverse': !(hasTop || hasBottom) && textPosition === 'top'
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
      v-if="hasTop"
      :style="{
        color: frameTextTop ? (textColorTop || frameStyle.textColor) : frameStyle.textColor,
        fontFamily: frameTextTop ? (fontFamilyTop || frameStyle.fontFamily || undefined) : (frameStyle.fontFamily || undefined),
        fontSize: frameTextTop ? `${fontSizeTop}px` : undefined,
        fontWeight: frameTextTop ? fontWeightTop : undefined,
        fontStyle: frameTextTop ? fontStyleTop : undefined,
        margin: 0,
        textAlign: 'center',
        maxWidth: `${PREVIEW_QRCODE_DIM_UNIT}px`,
        whiteSpace: 'pre-line'
      }"
    >
      {{ frameTextTop || frameText }}
    </p>

    <!-- Side Text if active (left/right only) -->
    <p
      v-if="!(hasTop || hasBottom) && (textPosition === 'left' || textPosition === 'right')"
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
      v-if="hasBottom"
      :style="{
        color: frameTextBottom ? (textColorBottom || frameStyle.textColor) : frameStyle.textColor,
        fontFamily: frameTextBottom ? (fontFamilyBottom || frameStyle.fontFamily || undefined) : (frameStyle.fontFamily || undefined),
        fontSize: frameTextBottom ? `${fontSizeBottom}px` : undefined,
        fontWeight: frameTextBottom ? fontWeightBottom : undefined,
        fontStyle: frameTextBottom ? fontStyleBottom : undefined,
        margin: 0,
        textAlign: 'center',
        maxWidth: `${PREVIEW_QRCODE_DIM_UNIT}px`,
        whiteSpace: 'pre-line'
      }"
    >
      {{ frameTextBottom || frameText }}
    </p>
  </div>
</template>
