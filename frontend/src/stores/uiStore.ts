/**
 * 界面状态：风险否决记录的读写、名次表筛选条件、评分页的临时权重。
 * 临时权重放在 store 里，拖权重条时首页与评分页共享同一份实时结果。
 *
 * 否决记录采用「解除留痕」模型：解除不会删记录，而是把 status 置为 lifted 并
 * 记录解除人 / 时间 / 原因；名次表、地图与等级只看 active（生效中）的记录。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { db, toPlain } from '@/utils/db'
import { isVetoActive, type RiskVeto } from '@/types/veto'
import type { VetoLiftInfo } from '@/types/veto'
import type { FactorWeights, NormalizeMethod, GradeThresholds } from '@/types/score'
import { DEFAULT_WEIGHTS } from '@/types/score'
import type { AccessMode, SurfaceType } from '@/types/campsite'
import { nowIso, todayIso } from '@/utils/format'

/** 台账 / 详情统一排序：判定日期倒序，同日再按录入时间倒序。 */
function sortByJudgedAt(a: RiskVeto, b: RiskVeto): number {
  if (a.judgedAt !== b.judgedAt) return a.judgedAt < b.judgedAt ? 1 : -1
  return a.createdAt < b.createdAt ? 1 : -1
}

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

  async function addVeto(
    input: Omit<RiskVeto, 'id' | 'status' | 'liftedBy' | 'liftedAt' | 'liftReason' | 'createdAt' | 'updatedAt'>
  ): Promise<number> {
    const now = nowIso()
    const record = toPlain({
      ...input,
      judgedAt: input.judgedAt || todayIso(),
      status: 'active' as const,
      liftedBy: null,
      liftedAt: null,
      liftReason: null,
      createdAt: now,
      updatedAt: now
    }) as RiskVeto
    const id = await db.vetos.add(record)
    await loadVetos()
    return id
  }

  /**
   * 解除否决：不删除原记录，只把状态置为 lifted 并写入复核信息。
   * 复核信息（解除人 / 时间 / 原因）由调用方校验完整后再调用。
   */
  async function liftVeto(id: number, info: VetoLiftInfo): Promise<void> {
    await db.vetos.update(id, {
      status: 'lifted',
      liftedBy: info.liftedBy,
      liftedAt: info.liftedAt,
      liftReason: info.liftReason,
      updatedAt: nowIso()
    })
    await loadVetos()
  }

  /** 某营位的全部否决记录（含已解除），台账与营位详情用。 */
  function vetosOf(siteId: number | null | undefined): RiskVeto[] {
    if (siteId == null) return []
    return vetos.value
      .filter((v) => v.siteId === siteId)
      .sort(sortByJudgedAt)
  }

  /** 某营位仍生效的否决记录（已解除的不计），名次表与地图用。 */
  function activeVetosOf(siteId: number | null | undefined): RiskVeto[] {
    return vetosOf(siteId).filter(isVetoActive)
  }

  function isVetoed(siteId: number | null | undefined): boolean {
    return activeVetosOf(siteId).length > 0
  }

  /** 命中生效否决的营位 id 集合，名次表与地图共用。 */
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

  /** 否决记录总数（含已解除的历史记录）。 */
  const vetoTotal = computed(() => vetos.value.length)
  /** 生效中否决记录数。 */
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
    liftVeto,
    vetosOf,
    activeVetosOf,
    isVetoed,
    syncFromProfile,
    resetFilters
  }
})
