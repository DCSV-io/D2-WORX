<script lang="ts">
  import Section from "./section.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
</script>

<Section id="overlays" title="Overlays">
  <div class="flex flex-wrap gap-4 rounded-lg border p-6">
    <!-- Dialog -->
    <Dialog.Root>
      <Dialog.Trigger>
        <Button variant="outline">Open Dialog</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Edit Profile</Dialog.Title>
          <Dialog.Description>
            Make changes to your profile here. Click save when you're done.
          </Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-4 py-4">
          <div class="flex flex-col gap-2">
            <Label for="dialog-name">Name</Label>
            <Input id="dialog-name" value="Jane Doe" />
          </div>
          <div class="flex flex-col gap-2">
            <Label for="dialog-email">Email</Label>
            <Input id="dialog-email" value="jane@example.com" />
          </div>
        </div>
        <Dialog.Footer>
          <Button>Save changes</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>

    <!-- Dropdown Menu -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <Button variant="outline">Open Menu</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="w-48">
        <DropdownMenu.Label>My Account</DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>Profile</DropdownMenu.Item>
        <DropdownMenu.Item>Billing</DropdownMenu.Item>
        <DropdownMenu.Item>Settings</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item>Log out</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <!-- Popover -->
    <Popover.Root>
      <Popover.Trigger>
        <Button variant="outline">Open Popover</Button>
      </Popover.Trigger>
      <Popover.Content class="w-72">
        <div class="flex flex-col gap-3">
          <h4 class="font-medium text-sm">Dimensions</h4>
          <p class="text-xs text-muted-foreground">Set the dimensions for the layer.</p>
          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1">
              <Label for="pop-w" class="text-xs">Width</Label>
              <Input id="pop-w" value="100%" class="h-8 text-xs" />
            </div>
            <div class="flex flex-col gap-1">
              <Label for="pop-h" class="text-xs">Height</Label>
              <Input id="pop-h" value="25px" class="h-8 text-xs" />
            </div>
          </div>
        </div>
      </Popover.Content>
    </Popover.Root>

    <!-- Sheet -->
    <Sheet.Root>
      <Sheet.Trigger>
        <Button variant="outline">Open Sheet</Button>
      </Sheet.Trigger>
      <Sheet.Content side="left">
        <Sheet.Header>
          <Sheet.Title>Navigation</Sheet.Title>
          <Sheet.Description>Example side navigation panel.</Sheet.Description>
        </Sheet.Header>
        <div class="flex flex-col gap-2 py-4">
          <Button variant="ghost" class="justify-start">Dashboard</Button>
          <Button variant="ghost" class="justify-start">Settings</Button>
          <Button variant="ghost" class="justify-start">Help</Button>
        </div>
      </Sheet.Content>
    </Sheet.Root>
  </div>
</Section>
