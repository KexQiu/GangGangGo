export type TodayFeedbackInput = {
  habitCompletion: number;
  toiletSessionCount: number;
  trainingCount: number;
  trainingTarget: number;
};

export type TodayPositiveFeedback = {
  body: string;
  title: string;
};

export function getTodayPositiveFeedback(input: TodayFeedbackInput): TodayPositiveFeedback {
  const trainingComplete = input.trainingCount >= input.trainingTarget;
  const habitComplete = input.habitCompletion >= 4;
  const hasTraining = input.trainingCount > 0;
  const hasHabit = input.habitCompletion > 0;
  const hasToiletRecord = input.toiletSessionCount > 0;

  if (trainingComplete && habitComplete) {
    return {
      body: hasToiletRecord
        ? '小花下班，小账本满格，收工记录也入账。今天不用卷了。'
        : '小花下班，小账本满格。今天不用卷了。',
      title: '今日状态很稳',
    };
  }

  if (trainingComplete) {
    return {
      body: '建议量已完成，休息和放松也是正经训练。',
      title: '小花已下班',
    };
  }

  if (habitComplete) {
    return {
      body: '4 项都记上了，今天的习惯状态很清楚。',
      title: '小账本满格',
    };
  }

  if (hasTraining && hasHabit) {
    return {
      body: '菊花抬和小账本都有进度，剩下的慢慢补。',
      title: '已经开张了',
    };
  }

  if (hasTraining) {
    return {
      body: '完成一点也算数，今天已经不是空白页。',
      title: '小花已开张',
    };
  }

  if (hasHabit) {
    return {
      body: `已记 ${input.habitCompletion}/4，先有记录就很好。`,
      title: '小账本已开张',
    };
  }

  if (hasToiletRecord) {
    return {
      body: '收工记录已入账。接下来可以从一个小动作开始。',
      title: '收工已入账',
    };
  }

  return {
    body: '点一下打卡，或先做一组菊花抬，今天就不是空白页。',
    title: '先从一件小事开始',
  };
}

export function getTrainingStatusLabel(count: number, target: number): string {
  if (count >= target) {
    return '已下班';
  }

  if (count > 0) {
    return '已开张';
  }

  return '待营业';
}

export function getHabitStatusLabel(completion: number): string {
  if (completion >= 4) {
    return '满格';
  }

  if (completion > 0) {
    return '已记录';
  }

  return '待开张';
}

export function getToiletStatusLabel(count: number): string {
  return count > 0 ? '已入账' : '未记录';
}
