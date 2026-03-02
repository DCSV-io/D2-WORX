<script lang="ts">
  import Section from "./section.svelte";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import * as Accordion from "$lib/components/ui/accordion/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
</script>

<Section id="navigation" title="Navigation">
  <div class="grid gap-6 md:grid-cols-2">
    <!-- Tabs -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium text-muted-foreground">Tabs</h3>
      <Card.Root>
        <Card.Content class="pt-6">
          <Tabs.Root value="overview">
            <Tabs.List>
              <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
              <Tabs.Trigger value="analytics">Analytics</Tabs.Trigger>
              <Tabs.Trigger value="reports">Reports</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="overview" class="pt-4">
              <p class="text-sm text-muted-foreground">
                Overview content goes here. This panel shows when the Overview tab is selected.
                Tabs are great for organizing related content into separate views.
              </p>
            </Tabs.Content>
            <Tabs.Content value="analytics" class="pt-4">
              <p class="text-sm text-muted-foreground">
                Analytics dashboard content. Charts, graphs, and key metrics would be displayed in
                this panel.
              </p>
            </Tabs.Content>
            <Tabs.Content value="reports" class="pt-4">
              <p class="text-sm text-muted-foreground">
                Reports section. Generated reports, export options, and historical data live here.
              </p>
            </Tabs.Content>
          </Tabs.Root>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Accordion -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium text-muted-foreground">Accordion</h3>
      <Card.Root>
        <Card.Content class="pt-6">
          <Accordion.Root type="single">
            <Accordion.Item value="item-1">
              <Accordion.Trigger>Is it accessible?</Accordion.Trigger>
              <Accordion.Content>
                Yes. Accordion follows the WAI-ARIA design pattern for disclosure widgets. It supports
                keyboard navigation and screen readers.
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="item-2">
              <Accordion.Trigger>Is it styled?</Accordion.Trigger>
              <Accordion.Content>
                Yes. It comes with default styling that integrates with the shadcn-svelte theme system
                and your chosen color palette.
              </Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="item-3">
              <Accordion.Trigger>Is it animated?</Accordion.Trigger>
              <Accordion.Content>
                Yes. It uses CSS transitions for smooth open/close animations. The animation is
                subtle and respects reduced-motion preferences.
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</Section>
