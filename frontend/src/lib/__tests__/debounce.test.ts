import { describe, expect, it, vi } from 'vitest'
import { debounce } from '@/lib/debounce'

describe('debounce', () => {
  it('only invokes the wrapped function once after the delay, using the last call args', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('first')
    debounced('second')
    debounced('third')

    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('third')
    vi.useRealTimers()
  })

  it('cancel() prevents a pending invocation', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    debounced.cancel()
    vi.advanceTimersByTime(200)

    expect(fn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
