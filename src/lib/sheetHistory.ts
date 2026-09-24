/**
 * Android's back button (and browser back) should close the top sheet, not
 * leave the page. Each open sheet pushes a history entry tagged with its
 * depth; popping below that depth closes it. Closing from the UI pops our
 * own entry so history doesn't fill up with dead states.
 */

interface Entry {
  close: () => void
}

const stack: Entry[] = []
let ignorePops = 0
let listening = false

function onPop(e: PopStateEvent) {
  if (ignorePops > 0) {
    ignorePops -= 1
    return
  }
  const depth = (e.state as { wigSheet?: number } | null)?.wigSheet ?? 0
  while (stack.length > depth) stack.pop()!.close()
}

export function pushSheet(close: () => void): () => void {
  if (!listening) {
    window.addEventListener('popstate', onPop)
    listening = true
  }
  const entry: Entry = { close }
  stack.push(entry)
  const depth = stack.length
  history.pushState({ ...(history.state as object | null), wigSheet: depth }, '')
  return () => {
    const i = stack.indexOf(entry)
    if (i === -1) return // already closed by a back press
    stack.splice(i, 1)
    if ((history.state as { wigSheet?: number } | null)?.wigSheet === depth) {
      ignorePops += 1
      history.back()
    }
  }
}
