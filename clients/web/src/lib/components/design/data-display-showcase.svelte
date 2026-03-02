<script lang="ts">
  import Section from "./section.svelte";
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import { Toggle } from "$lib/components/ui/toggle/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
  import InfoIcon from "@lucide/svelte/icons/info";
  import AlertTriangleIcon from "@lucide/svelte/icons/triangle-alert";
  import OctagonXIcon from "@lucide/svelte/icons/octagon-x";
  import CheckCircleIcon from "@lucide/svelte/icons/circle-check";
  import BoldIcon from "@lucide/svelte/icons/bold";
  import ItalicIcon from "@lucide/svelte/icons/italic";
  import UnderlineIcon from "@lucide/svelte/icons/underline";

  const tableData = [
    { id: "INV001", status: "Paid", method: "Credit Card", amount: "$250.00" },
    { id: "INV002", status: "Pending", method: "PayPal", amount: "$150.00" },
    { id: "INV003", status: "Unpaid", method: "Bank Transfer", amount: "$350.00" },
    { id: "INV004", status: "Paid", method: "Credit Card", amount: "$450.00" },
    { id: "INV005", status: "Paid", method: "PayPal", amount: "$550.00" },
  ];
</script>

<Section id="data-display" title="Data Display">
  <div class="flex flex-col gap-6">
    <!-- Avatars -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium text-muted-foreground">Avatars</h3>
      <div class="flex items-center gap-4 rounded-lg border p-6">
        <Avatar class="size-8">
          <AvatarFallback>SM</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>MD</AvatarFallback>
        </Avatar>
        <Avatar class="size-12">
          <AvatarFallback>LG</AvatarFallback>
        </Avatar>
        <Avatar class="size-16">
          <AvatarFallback>XL</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarImage src="https://api.dicebear.com/9.x/initials/svg?seed=JD" alt="JD" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
      </div>
    </div>

    <!-- Badges -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium text-muted-foreground">Badges</h3>
      <div class="flex flex-wrap items-center gap-3 rounded-lg border p-6">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="accent">New</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="outline">Outline</Badge>
      </div>
    </div>

    <!-- Status Badges -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium text-muted-foreground">Status Badges</h3>
      <div class="flex flex-wrap items-center gap-3 rounded-lg border p-6">
        <Badge class="bg-info text-info-foreground hover:bg-info/80 border-transparent">Info</Badge>
        <Badge class="bg-success text-success-foreground hover:bg-success/80 border-transparent">Success</Badge>
        <Badge class="bg-warning text-warning-foreground hover:bg-warning/80 border-transparent">Warning</Badge>
        <Badge class="bg-destructive text-destructive-foreground hover:bg-destructive/80 border-transparent">Danger</Badge>
      </div>
    </div>

    <!-- Alerts -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium text-muted-foreground">Alerts</h3>
      <div class="flex flex-col gap-3">
        <Alert.Root>
          <CircleAlertIcon />
          <Alert.Title>Heads up!</Alert.Title>
          <Alert.Description>
            You can add components to your app using the CLI or by copying and pasting.
          </Alert.Description>
        </Alert.Root>

        <Alert.Root class="border-info/50 text-info [&>svg]:text-info">
          <InfoIcon />
          <Alert.Title>Info</Alert.Title>
          <Alert.Description>
            A new software update is available. See what's new in version 4.0.
          </Alert.Description>
        </Alert.Root>

        <Alert.Root class="border-success/50 text-success [&>svg]:text-success">
          <CheckCircleIcon />
          <Alert.Title>Success</Alert.Title>
          <Alert.Description>
            Your changes have been saved successfully.
          </Alert.Description>
        </Alert.Root>

        <Alert.Root class="border-warning/50 text-warning [&>svg]:text-warning">
          <AlertTriangleIcon />
          <Alert.Title>Warning</Alert.Title>
          <Alert.Description>
            Your trial expires in 3 days. Upgrade now to keep your data.
          </Alert.Description>
        </Alert.Root>

        <Alert.Root class="border-destructive/50 text-destructive [&>svg]:text-destructive">
          <OctagonXIcon />
          <Alert.Title>Error</Alert.Title>
          <Alert.Description>
            Your session has expired. Please log in again to continue.
          </Alert.Description>
        </Alert.Root>
      </div>
    </div>

    <!-- Tooltips + Toggle -->
    <div class="grid gap-6 md:grid-cols-2">
      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-muted-foreground">Tooltips</h3>
        <div class="flex gap-3 rounded-lg border p-6">
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger>
                <Button variant="outline" size="sm">Hover me</Button>
              </Tooltip.Trigger>
              <Tooltip.Content>
                <p>This is a tooltip message</p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-muted-foreground">Toggle</h3>
        <div class="flex gap-2 rounded-lg border p-6">
          <Toggle aria-label="Toggle bold">
            <BoldIcon class="size-4" />
          </Toggle>
          <Toggle aria-label="Toggle italic">
            <ItalicIcon class="size-4" />
          </Toggle>
          <Toggle aria-label="Toggle underline">
            <UnderlineIcon class="size-4" />
          </Toggle>
        </div>
      </div>
    </div>

    <!-- Separator -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium text-muted-foreground">Separator</h3>
      <div class="rounded-lg border p-6">
        <div class="flex flex-col gap-1">
          <h4 class="text-sm font-medium">D2-WORX</h4>
          <p class="text-xs text-muted-foreground">An open-source microservices framework</p>
        </div>
        <Separator class="my-4" />
        <div class="flex h-5 items-center gap-4 text-sm">
          <span>Docs</span>
          <Separator orientation="vertical" />
          <span>Source</span>
          <Separator orientation="vertical" />
          <span>Support</span>
        </div>
      </div>
    </div>

    <!-- Scroll Area -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium text-muted-foreground">Scroll Area</h3>
      <ScrollArea class="h-48 rounded-lg border">
        <div class="p-4">
          {#each Array.from({ length: 20 }, (_, i) => i + 1) as n (n)}
            <div class="py-2 text-sm">
              Item {n} — This is a scrollable list item demonstrating the scroll area component.
            </div>
            {#if n < 20}
              <Separator />
            {/if}
          {/each}
        </div>
      </ScrollArea>
    </div>

    <!-- Table -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium text-muted-foreground">Table</h3>
      <div class="rounded-lg border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head class="w-24">Invoice</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Method</Table.Head>
              <Table.Head class="text-right">Amount</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each tableData as row (row.id)}
              <Table.Row>
                <Table.Cell class="font-medium">{row.id}</Table.Cell>
                <Table.Cell>
                  <Badge variant={row.status === "Paid" ? "default" : row.status === "Pending" ? "secondary" : "outline"}>
                    {row.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>{row.method}</Table.Cell>
                <Table.Cell class="text-right">{row.amount}</Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    </div>
  </div>
</Section>
