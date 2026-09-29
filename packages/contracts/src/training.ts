import { z } from 'zod';

export const trainingPresetIdSchema = z.enum(['beginner', 'standard', 'quick']);
export type TrainingPresetId = z.infer<typeof trainingPresetIdSchema>;
export const trainingDefaults = {
  beginner: { contractSeconds: 3, relaxSeconds: 3, repetitions: 10 },
  standard: { contractSeconds: 5, relaxSeconds: 5, repetitions: 12 },
  quick: { contractSeconds: 1, relaxSeconds: 1, repetitions: 16 },
} as const;

export const trainingParametersSchema = z
  .object({
    contractSeconds: z.number().int().min(1).max(5),
    relaxSeconds: z.number().int().min(1).max(30),
    repetitions: z.number().int().min(1).max(16),
  })
  .strict();
export type TrainingParameters = z.infer<typeof trainingParametersSchema>;
export const trainingFeedbackSchema = z.enum(['unanswered', 'none', 'reported']);
export const trainingEndReasonSchema = z.enum(['completed', 'user_stopped', 'discomfort', 'interrupted']);
export type TrainingFeedback = z.infer<typeof trainingFeedbackSchema>;
export type TrainingEndReason = z.infer<typeof trainingEndReasonSchema>;

export function validTrainingParameters(id: TrainingPresetId, plan: TrainingParameters) {
  const base = trainingDefaults[id];
  return (
    trainingParametersSchema.safeParse(plan).success &&
    plan.contractSeconds <= base.contractSeconds &&
    plan.relaxSeconds >= base.relaxSeconds &&
    plan.repetitions <= base.repetitions
  );
}
const parametersFor = (id: TrainingPresetId) =>
  trainingParametersSchema.refine((plan) => validTrainingParameters(id, plan), {
    message: '训练设置超出此节奏的可调整范围。',
  });
export const trainingPreferencesSchema = z
  .object({
    presets: z
      .object({
        beginner: parametersFor('beginner'),
        standard: parametersFor('standard'),
        quick: parametersFor('quick'),
      })
      .strict(),
    dailyTarget: z.union([z.literal(1), z.literal(2)]).nullable(),
    onboardingSeen: z.boolean(),
  })
  .strict();
export type TrainingPreferences = z.infer<typeof trainingPreferencesSchema>;
export function createDefaultTrainingPreferences(): TrainingPreferences {
  return {
    presets: {
      beginner: { ...trainingDefaults.beginner },
      standard: { ...trainingDefaults.standard },
      quick: { ...trainingDefaults.quick },
    },
    dailyTarget: null,
    onboardingSeen: false,
  };
}
