interface MultiQuestionResult {
  hasMultipleQuestions: boolean;
  questions: string[];
  confidence: number;
}

/**
 * Detects if the content contains multiple questions that should be branched.
 *
 * Detection strategies:
 * 1. Numbered lists (1. 2. 3. or - - -)
 * 2. Multiple question marks
 * 3. Connecting words (另外、还有、and、also、additionally)
 */
export function detectMultipleQuestions(content: string): MultiQuestionResult {
  const questions: string[] = [];
  let confidence = 0;

  // Strategy 1: Detect numbered lists
  const numberedListPattern = /(?:^|\n)\s*(?:\d+[.)]\s*|[-•*]\s+)(.+?)(?=(?:\n\s*(?:\d+[.)]\s*|[-•*]\s+))|$)/gs;
  const numberedMatches = [...content.matchAll(numberedListPattern)];

  if (numberedMatches.length >= 2) {
    for (const match of numberedMatches) {
      if (match[1]) {
        questions.push(match[1].trim());
      }
    }
    confidence = Math.min(0.9, 0.5 + numberedMatches.length * 0.1);
  }

  // Strategy 2: Detect multiple question marks (if no numbered list found)
  if (questions.length === 0) {
    const questionMarkPattern = /([^?]+\?)/g;
    const questionMatches = [...content.matchAll(questionMarkPattern)];

    if (questionMatches.length >= 2) {
      for (const match of questionMatches) {
        if (match[1]) {
          questions.push(match[1].trim());
        }
      }
      confidence = Math.min(0.8, 0.4 + questionMatches.length * 0.1);
    }
  }

  // Strategy 3: Detect connecting words (if no other patterns found)
  if (questions.length === 0) {
    const connectingWordsPattern =
      /(.+?)(?:另外|还有|还想|and also|additionally|furthermore|moreover|besides|plus|also,)/gi;
    const connectingMatches = [...content.matchAll(connectingWordsPattern)];

    if (connectingMatches.length >= 1) {
      // Add the first part
      if (connectingMatches[0]?.[1]) {
        questions.push(connectingMatches[0][1].trim());
      }

      // Add the rest of the content after the last match
      const lastMatch = connectingMatches[connectingMatches.length - 1];
      if (lastMatch) {
        const restContent = content.slice(
          (lastMatch.index ?? 0) + lastMatch[0].length
        ).trim();
        if (restContent) {
          questions.push(restContent);
        }
      }

      confidence = 0.6;
    }
  }

  return {
    hasMultipleQuestions: questions.length >= 2,
    questions,
    confidence,
  };
}

/**
 * Determines if auto-branching should be triggered based on detection result.
 */
export function shouldAutoBranch(result: MultiQuestionResult): boolean {
  return result.hasMultipleQuestions && result.confidence >= 0.5;
}
