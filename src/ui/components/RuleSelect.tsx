import { t } from '../../i18n';

type RuleValue = 'exact' | 'ignore' | 'collapse' | 'lexical' | 'flexible';

export function RuleSelect<V extends RuleValue>(props: { label: string; value: V; values: V[]; onChange: (v: V) => void }) {
  return (
    <label>
      {props.label}
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as V)}>
        {props.values.map((v) => (
          <option key={v} value={v}>
            {t(`rules.${v}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CustomRules(props: {
  value: import('../../engine').WhitespaceRules;
  onChange: (v: import('../../engine').WhitespaceRules) => void;
}) {
  const { value, onChange } = props;
  return (
    <div className="custom">
      <RuleSelect label={t('rules.indentation')} value={value.indentation} values={['exact', 'ignore']} onChange={(v) => onChange({ ...value, indentation: v })} />
      <RuleSelect label={t('rules.inlineSpaces')} value={value.inlineSpaces} values={['exact', 'collapse', 'lexical']} onChange={(v) => onChange({ ...value, inlineSpaces: v })} />
      <RuleSelect label={t('rules.lineBreaks')} value={value.lineBreaks} values={['exact', 'flexible']} onChange={(v) => onChange({ ...value, lineBreaks: v })} />
      <RuleSelect label={t('rules.blankLines')} value={value.blankLines} values={['exact', 'ignore']} onChange={(v) => onChange({ ...value, blankLines: v })} />
    </div>
  );
}
