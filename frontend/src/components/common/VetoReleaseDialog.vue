<script setup lang="ts">
/**
 * VetoReleaseDialog —— 解除风险否决的复核弹窗。
 * 解除不删记录：确认后由父页面把状态置为「已解除」并写入复核信息留痕。
 * 解除人、解除日期、解除原因三项必填，未填完整时确认按钮保持禁用。
 * 被 `/sites/:id`（营位详情）与 `/veto`（否决台账）共同消费。
 */
import { computed, reactive, watch } from 'vue'
import type { RiskVeto, VetoRelease } from '@/types/veto'
import { formatDate, todayIso } from '@/utils/format'

const props = defineProps<{
  modelValue: boolean
  /** 待解除的否决记录；为 null 时不渲染内容 */
  veto: RiskVeto | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [release: VetoRelease]
}>()

const form = reactive({
  releasedBy: '',
  releasedAt: todayIso(),
  reason: ''
})

/** 复核信息没填完整就不允许提交 */
const complete = computed(
  () =>
    Boolean(form.releasedBy.trim()) && Boolean(form.releasedAt) && Boolean(form.reason.trim())
)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    form.releasedBy = ''
    form.releasedAt = todayIso()
    form.reason = ''
  }
)

function close(): void {
  emit('update:modelValue', false)
}

function submit(): void {
  if (!complete.value) return
  emit('confirm', {
    releasedBy: form.releasedBy.trim(),
    releasedAt: form.releasedAt,
    reason: form.reason.trim()
  })
  close()
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="解除风险否决"
    width="480px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="veto">
      <div class="release-target">
        <el-tag type="danger" size="small">{{ veto.type }}</el-tag>
        <p class="release-target__desc">{{ veto.description }}</p>
        <p class="release-target__meta">
          判定人 {{ veto.judge }} · 判定日期 {{ formatDate(veto.judgedAt) }}
        </p>
      </div>
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="解除后原判定记录仍会保留"
        description="台账与营位详情继续展示原判定，并标明解除人、解除时间与原因；名次表、地图与等级按剩余生效否决重新判定。"
      />
      <el-form label-width="92px" class="release-form" @submit.prevent>
        <el-form-item label="解除人" required>
          <el-input id="release-by" v-model="form.releasedBy" placeholder="复核人姓名，如 李营" />
        </el-form-item>
        <el-form-item label="解除日期" required>
          <el-date-picker
            id="release-at"
            v-model="form.releasedAt"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="解除原因" required>
          <el-input
            id="release-reason"
            v-model="form.reason"
            type="textarea"
            :rows="3"
            placeholder="复核结论，如隐患已排除、现场复核无风险等"
          />
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button
        id="release-submit"
        type="danger"
        :disabled="!complete"
        @click="submit"
      >
        确认解除
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.release-target {
  background: var(--gb-surface);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.release-target__desc {
  margin: 8px 0 4px;
  font-size: 13px;
  color: var(--gb-ink);
}
.release-target__meta {
  margin: 0;
  font-size: 12px;
  color: var(--gb-muted);
}
.release-form {
  margin-top: 14px;
}
</style>
