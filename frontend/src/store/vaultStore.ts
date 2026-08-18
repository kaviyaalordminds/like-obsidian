import { create } from 'zustand'
import { api } from '@/api/client'
import type { TreeNode, Vault } from '@/types'

interface VaultState {
  vaults: Vault[]
  currentVault: Vault | null
  tree: TreeNode | null
  loading: boolean
  error: string | null

  loadVaults: () => Promise<void>
  createVault: (name: string) => Promise<Vault>
  openVault: (vault: Vault) => Promise<void>
  refreshTree: () => Promise<void>
  forgetVault: (vaultId: string) => Promise<void>
}

const LAST_VAULT_KEY = 'like-obsidian:last-vault-id'

export const useVaultStore = create<VaultState>((set, get) => ({
  vaults: [],
  currentVault: null,
  tree: null,
  loading: false,
  error: null,

  loadVaults: async () => {
    set({ loading: true, error: null })
    try {
      const vaults = await api.listVaults()
      set({ vaults, loading: false })
      const lastId = localStorage.getItem(LAST_VAULT_KEY)
      const toOpen = vaults.find((v) => v.id === lastId) ?? vaults[0]
      if (toOpen && !get().currentVault) {
        await get().openVault(toOpen)
      }
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  createVault: async (name: string) => {
    const vault = await api.createVault(name)
    set((s) => ({ vaults: [vault, ...s.vaults] }))
    return vault
  },

  openVault: async (vault: Vault) => {
    set({ loading: true, error: null })
    try {
      const tree = await api.openVault(vault.id)
      localStorage.setItem(LAST_VAULT_KEY, vault.id)
      set({ currentVault: vault, tree, loading: false })
    } catch (e) {
      set({ loading: false, error: (e as Error).message })
    }
  },

  refreshTree: async () => {
    const vault = get().currentVault
    if (!vault) return
    const tree = await api.getTree(vault.id)
    set({ tree })
  },

  forgetVault: async (vaultId: string) => {
    await api.forgetVault(vaultId)
    set((s) => ({
      vaults: s.vaults.filter((v) => v.id !== vaultId),
      currentVault: s.currentVault?.id === vaultId ? null : s.currentVault,
      tree: s.currentVault?.id === vaultId ? null : s.tree,
    }))
  },
}))
