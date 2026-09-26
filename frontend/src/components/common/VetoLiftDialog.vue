<script setup lang="ts">
/**
 * VetoLiftDialog —— 解除风险否决的复核对话框。
 *
 * 解除属于留痕操作：原判定记录保留，只在其上写入解除人、解除时间与解除原因。
 * 三项复核信息必须全部填写（且非纯空白），否则不允许提交。
 * 被 /veto 台账页与 /sites/:id 详情页共用。
 */
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useUiStore } from '@/stores/uiStore'
import type { RiskVeto } from '@/types/veto'
import { nowLocalInput } from '@/utils/format'
import { formatDate } from '@/utils/format'

const props = defineProps<{
  /** v-model 控制显隐 */
  modelValue: boolean
  /** 待解除的否决记录 */
  veto: RiskVeto | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const uiStore = useUiStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  liftedBy: '',
  liftedAt: nowLocalInput(),
  liftReason: ''
})

const rules: FormRules = {
  liftedBy: [{ required: true, validator: requiredValidator, trigger: 'blur' }],
  liftedAt: [{ required: true, validator: requiredValidator, trigger: 'change' }],
  liftReason: [{ required: true, validator: requiredValidator, trigger: 'blur' }]
}

function requiredValidator(_rule: unknown, value: unknown, callback: (err?: Error) => void): void {
  if (typeof value === 'string' && value.trim()) {
    callback()
  } else {
    callback(new Error('必填项'))
  }
}

// 每次打开重置为当前时间并清掉上一轮校验态
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.liftedBy = ''
      form.liftedAt = nowLocalInput()
      form.liftReason = ''
      void formRef.value?.clearValidate()
    }
  }
)

function close(): void {
  emit('update:modelValue', false)
}

async function submit(): Promise<void> {
  if (!props.veto || typeof props.veto.id !== 'number') return
  // 双保险：复核信息没填完整不允许提交
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!form.liftedBy.trim() || !form.liftedAt || !form.liftReason.trim()) {
    ElMessage.warning('请完整填写解除人、解除时间与解除原因')
    return
  }
  submitting.value = true
  try {
    await uiStore.liftVeto(props.veto.id, {
      liftedBy: form.liftedBy.trim(),
      liftedAt: form.liftedAt,
      liftReason: form.liftReason.trim()
    })
    ElMessage.success('已解除该否决项，名次表、地图与等级按剩余有效否决重新判定')
    close()
  } catch (err) {
    ElMessage.error(`解除失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="解除风险否决（复核留痕）"
    width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-alert
      v-if="veto"
      type="info"
      :closable="false"
      show-icon
      class="lift-alert"
      :title="`原判定：${veto.type} · ${formatDate(veto.judgedAt)} · 判定人 ${veto.judge || '—'}`"
      description="解除不会删除原判定：台账与营位详情继续显示该判定，仅名次表、地图与推荐等级不再受其影响。"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="92px" @submit.prevent>
      <el-form-item label="解除人" prop="liftedBy">
        <el-input
          id="lift-by"
          v-model="form.liftedBy"
          placeholder="填写本次复核 / 解除负责人"
          maxlength="30"
        />
      </el-form-item>
      <el-form-item label="解除时间" prop="liftedAt">
        <el-date-picker
          id="lift-at"
          v-model="form.liftedAt"
          type="datetime"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DDTHH:mm"
          placeholder="选择解除发生时间"
          :clearable="false"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="解除原因" prop="liftReason">
        <el-input
          id="lift-reason"
          v-model="form.liftReason"
          type="textarea"
          :rows="3"
          placeholder="写明复核结论与依据，如：现场已设导流沟且复测不在行洪线内"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">确认解除</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.lift-alert {
  margin-bottom: 14px;
}
</style>
