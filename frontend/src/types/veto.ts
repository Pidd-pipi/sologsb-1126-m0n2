/**
 * RiskVeto（风险否决项）—— 命中即标红该营位并禁止评 A。
 * 属于「一票否决」类硬约束，与得分体系解耦。
 *
 * 解除否决不会删除记录：状态由 active 变为 lifted，原判定（类型、说明、判定人、
 * 判定日期）原样保留，同时记录解除人、解除时间与解除原因，台账与营位详情可长期追溯。
 */

/** 否决类型 */
export type VetoType = '河道内' | '山洪沟' | '孤树下' | '崖底落石区' | '陡坡'

/** 否决状态：active 生效中；lifted 已解除（记录保留，仅不再参与短路判定） */
export type VetoStatus = 'active' | 'lifted'

/** 解除否决时必填的复核信息 */
export interface VetoLiftInfo {
  /** 解除（复核）人 */
  liftedBy: string
  /** 解除时间（本地时间 YYYY-MM-DDTHH:mm，与 el-date-picker datetime 的 value-format 对齐） */
  liftedAt: string
  /** 解除原因（复核依据） */
  liftReason: string
}

export interface RiskVeto {
  /** 主键，自增 */
  id?: number
  /** 被否决的营位 id */
  siteId: number
  /** 否决类型 */
  type: VetoType
  /** 说明（现场情况、判定依据） */
  description: string
  /** 判定人 */
  judge: string
  /** 判定日期（YYYY-MM-DD） */
  judgedAt: string
  /** 状态：生效中 / 已解除 */
  status: VetoStatus
  /** 解除人；生效中为 null */
  liftedBy: string | null
  /** 解除时间；生效中为 null */
  liftedAt: string | null
  /** 解除原因；生效中为 null */
  liftReason: string | null
  createdAt: string
  updatedAt: string
}

/** 是否为仍在生效的否决记录（未解除）。 */
export function isVetoActive(v: RiskVeto | null | undefined): boolean {
  return !!v && v.status !== 'lifted'
}

export const VETO_TYPES: VetoType[] = ['河道内', '山洪沟', '孤树下', '崖底落石区', '陡坡']

/** 各否决类型的现场判定提示，表单内联展示 */
export const VETO_HINTS: Record<VetoType, string> = {
  河道内: '位于常水位河道或滩地内，暴雨时无法及时撤离。',
  山洪沟: '处于汇水沟口，短时强降雨易形成山洪直冲营位。',
  孤树下: '孤立高树下扎营，雷击与断枝落枝风险不可控。',
  崖底落石区: '崖壁正下方，存在落石历史痕迹或新鲜碎屑。',
  陡坡: '坡度超出营地允许范围，帐篷无法稳定铺设。'
}
