import '@shopify/ui-extensions/preact';
import { render } from 'preact';

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  return (
    <s-function-settings>
      <s-stack direction="block" gap="base">
        <s-banner tone="info" heading="No per-discount settings">
          <s-paragraph>
            Volume tiers are configured per product, not per discount. Open the
            Volume discount app and pick a product to set its{' '}
            <s-text type="strong">min_qty</s-text> and{' '}
            <s-text type="strong">discount_pct</s-text> tiers.
          </s-paragraph>
        </s-banner>
        <s-paragraph>
          The function reads each product's{' '}
          <s-text type="strong">custom.volume_tiers</s-text> metafield at
          checkout and applies the highest matching tier as a line-level
          percentage discount.
        </s-paragraph>
      </s-stack>
    </s-function-settings>
  );
}
