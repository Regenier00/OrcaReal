import { useLayoutEffect, useState } from 'react'

export interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

function visibleRect(selector: string): TargetRect | null {
  const nodes = document.querySelectorAll(`[data-tour="${selector}"]`)
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue
    const style = window.getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    const rect = node.getBoundingClientRect()
    if (rect.width < 8 || rect.height < 8) continue
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    }
  }
  return null
}

export function useTourTarget(selector: string | undefined, stepId: string) {
  const [rect, setRect] = useState<TargetRect | null>(null)

  useLayoutEffect(() => {
    let cancelled = false
    const update = () => {
      if (cancelled) return
      setRect(selector ? visibleRect(selector) : null)
    }

    if (selector) {
      document
        .querySelector(`[data-tour="${selector}"]`)
        ?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
    }

    const frame = window.requestAnimationFrame(update)
    const timer = window.setTimeout(update, 280)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [selector, stepId])

  return rect
}
