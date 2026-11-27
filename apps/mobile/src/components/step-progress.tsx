import { Text, View } from 'react-native';
import type { StepProgress as Progress } from '@kwetuly/shared';
import { Glyph } from '@/components/glyph';
import { useType } from '@/lib/use-type';
import { brand, colors, control, icon, radius, space } from '@/theme';

type Labels = { progressLabel: string; optional: string };

const TICK = { ios: 'checkmark.circle.fill', android: 'check_circle' } as const;
const OPEN = { ios: 'circle', android: 'radio_button_unchecked' } as const;
const OPTIONAL = { ios: 'circle.dashed', android: 'radio_button_unchecked' } as const;

/**
 * The sign-up progress line, the same as the website: "You have finished 3 of 6. 3 more steps to
 * finish.", a bar with one segment per step and a tick under each finished step. Optional steps show
 * a dashed circle and "Optional". `current` (0-based) outlines the step being edited.
 */
export function StepProgress({ progress, line, labels, current }: { progress: Progress; line: string; labels: Labels; current?: number }) {
  const { type, font } = useType();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ ...type.callout, ...font.bold, color: brand.leafDark }}>{line}</Text>
      {/* One progress bar for screen readers; the segments and ticks below are only visual. */}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={labels.progressLabel}
        accessibilityValue={{ min: 0, max: progress.total, now: progress.finished, text: line }}
        style={{ gap: space.xs }}
      >
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {progress.steps.map((s, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: control.bar,
                borderRadius: radius.bar,
                borderCurve: 'continuous',
                backgroundColor: s.done ? brand.leaf : colors.fill,
                borderWidth: i === current ? 2 : 0,
                borderColor: brand.forest,
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.xs }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {progress.steps.map((s, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: space.xxs }}>
              <Glyph name={s.done ? TICK : s.optional ? OPTIONAL : OPEN} size={icon.inline} color={s.done ? brand.leafDark : colors.secondaryLabel} />
              <Text style={{ ...type.meta, ...(i === current ? font.bold : font.regular), color: i === current ? colors.label : colors.secondaryLabel, fontVariant: ['tabular-nums'] }}>{i + 1}</Text>
              {s.optional && (
                <Text style={{ ...type.meta, color: colors.secondaryLabel, textAlign: 'center' }} numberOfLines={2}>
                  {labels.optional}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
