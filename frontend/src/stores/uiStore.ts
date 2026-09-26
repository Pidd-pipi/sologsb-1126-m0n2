/**
 * 界面状态：风险否决记录的读写、名次表筛选条件、评分页的临时权重。
 * 临时权重放在 store 里，拖权重条时首页与评分页共享同一份实时结果。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db, toPlain } from '@/utils/db'
import type { RiskVeto, VetoRelease } from '@/types/veto'
import { isVetoActive } from '@/types/veto'
import type { FactorWeights, NormalizeMethod, GradeThresholds } from '@/types/score'
import { DEFAULT_WEIGHTS } from '@/types/score'
import type { AccessMode, SurfaceType } from '@/types/campsite'
import { nowIso, todayIso } from '@/utils/format'

export const useUiStore = defineStore('ui', () => {
  const vetos = ref<RiskVeto[]>([])
  const loadingVetos = ref(false)

  /** 名次表筛选条件 */
  const filterCamp = ref<string>('')
  const filterSurface = ref<SurfaceType | ''>('')
  const filterAccess = ref<AccessMode | ''>('')
  const keyword = ref<string>('')

  /** 评分页拖动中的临时权重（未保存前不落库） */
  const workingWeights = ref<FactorWeights>({ ...DEFAULT_WEIGHTS })
  const workingNormalize = ref<NormalizeMethod>('minmax')
  const workingThresholds = ref<GradeThresholds>({ gradeA: 78, gradeB: 58 })
  const workingSeason = ref<string>('四季通用')
  const dirty = ref(false)

  /** 地图页当前选中的营位 id */
  const focusedSiteId = ref<number | null>(null)

  async function loadVetos(): Promise<void> {
    loadingVetos.value = true
    try {
      vetos.value = await db.vetos.toArray()
    } finally {
      loadingVetos.value = false
    }
  }

  async function addVeto(input: RiskVeto): Promise<number> {
    const now = nowIso()
    const record = toPlain({
      ...input,
      judgedAt: input.judgedAt || todayIso(),
      // 新登记的一律生效中；解除只能走 releaseVeto 留痕
      status: 'active',
      release: null,
      createdAt: now,
      updatedAt: now
    }) as RiskVeto
    delete record.id
    const id = await db.vetos.add(record)
    await loadVetos()
    return id
  }

  /**
   * 解除否决：不删记录，把状态置为已解除并写入复核信息（解除人 / 时间 / 原因）。
   * 复核信息没填完整直接拒绝提交。
   */
  async function releaseVeto(id: number, release: VetoRelease): Promise<void> {
    const releasedBy = release.releasedBy.trim()
    const releasedAt = release.releasedAt.trim()
    const reason = release.reason.trim()
    if (!releasedBy || !releasedAt || !reason) {
      throw new Error('解除人、解除时间与解除原因均需填写后才能提交')
    }
    await db.vetos.update(
      id,
      toPlain({
        status: 'released',
        release: { releasedBy, releasedAt, reason },
        updatedAt: nowIso()
      })
    )
    await loadVetos()
  }

  /** 某营位的全部否决记录（含已解除，台账与详情留痕用） */
  function vetosOf(siteId: number | null | undefined): RiskVeto[] {
    if (siteId == null) return []
    return vetos.value.filter((v) => v.siteId === siteId)
  }

  /** 某营位仍在生效的否决项（标红、压等级只看这部分） */
  function activeVetosOf(siteId: number | null | undefined): RiskVeto[] {
    return vetosOf(siteId).filter(isVetoActive)
  }

  function isVetoed(siteId: number | null | undefined): boolean {
    return activeVetosOf(siteId).length > 0
  }

  /** 命中生效否决的营位 id 集合，名次表与地图共用；解除后自动移出。 */
  const vetoedSiteIds = computed<number[]>(() =>
    Array.from(new Set(vetos.value.filter(isVetoActive).map((v) => v.siteId)))
  )

  /** 用启用方案覆盖临时权重。 */
  function syncFromProfile(
    weights: FactorWeights,
    normalize: NormalizeMethod,
    thresholds: GradeThresholds,
    season: string
  ): void {
    workingWeights.value = { ...DEFAULT_WEIGHTS, ...weights }
    workingNormalize.value = normalize
    workingThresholds.value = { ...thresholds }
    workingSeason.value = season
    dirty.value = false
  }

  function resetFilters(): void {
    filterCamp.value = ''
    filterSurface.value = ''
    filterAccess.value = ''
    keyword.value = ''
  }

  const vetoTotal = computed(() => vetos.value.length)
  /** 仍在生效的否决条数（页头统计与地图用） */
  const activeVetoTotal = computed(() => vetos.value.filter(isVetoActive).length)

  return {
    vetos,
    loadingVetos,
    vetoTotal,
    activeVetoTotal,
    filterCamp,
    filterSurface,
    filterAccess,
    keyword,
    workingWeights,
    workingNormalize,
    workingThresholds,
    workingSeason,
    dirty,
    focusedSiteId,
    vetoedSiteIds,
    loadVetos,
    addVeto,
    releaseVeto,
    vetosOf,
    activeVetosOf,
    isVetoed,
    syncFromProfile,
    resetFilters
  }
})
