<script lang="ts">
  import Section from "./section.svelte";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Slider } from "$lib/components/ui/slider/index.js";
  import { Button } from "$lib/components/ui/button/index.js";

  let switchChecked = $state(false);
  let checkboxChecked = $state(false);
  let sliderValue = $state(50);
  let selectValue = $state<string | undefined>(undefined);
</script>

<Section id="forms" title="Form Controls">
  <div class="grid gap-6 md:grid-cols-2">
    <!-- Text inputs -->
    <div class="flex flex-col gap-4 rounded-lg border p-6">
      <h3 class="text-sm font-medium text-muted-foreground">Text Inputs</h3>

      <div class="flex flex-col gap-2">
        <Label for="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="password">Password</Label>
        <Input id="password" type="password" placeholder="Enter password" />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="disabled-input">Disabled</Label>
        <Input id="disabled-input" placeholder="Can't touch this" disabled />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="message">Message</Label>
        <Textarea id="message" placeholder="Type your message here..." />
      </div>
    </div>

    <!-- Selection controls -->
    <div class="flex flex-col gap-4 rounded-lg border p-6">
      <h3 class="text-sm font-medium text-muted-foreground">Selection Controls</h3>

      <div class="flex flex-col gap-3">
        <Label>Select</Label>
        <Select.Root type="single" bind:value={selectValue}>
          <Select.Trigger class="w-full">
            <span class="truncate">{selectValue || "Select a fruit..."}</span>
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="apple">Apple</Select.Item>
            <Select.Item value="banana">Banana</Select.Item>
            <Select.Item value="cherry">Cherry</Select.Item>
            <Select.Item value="grape">Grape</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>

      <div class="flex items-center gap-2">
        <Checkbox id="terms" bind:checked={checkboxChecked} />
        <Label for="terms" class="text-sm">Accept terms and conditions</Label>
      </div>

      <div class="flex items-center gap-2">
        <Switch id="notifications" bind:checked={switchChecked} />
        <Label for="notifications" class="text-sm">
          Enable notifications {switchChecked ? "(on)" : "(off)"}
        </Label>
      </div>

      <div class="flex flex-col gap-3">
        <Label>Preferred contact</Label>
        <RadioGroup value="email">
          <div class="flex items-center gap-2">
            <RadioGroupItem value="email" id="r-email" />
            <Label for="r-email" class="text-sm font-normal">Email</Label>
          </div>
          <div class="flex items-center gap-2">
            <RadioGroupItem value="phone" id="r-phone" />
            <Label for="r-phone" class="text-sm font-normal">Phone</Label>
          </div>
          <div class="flex items-center gap-2">
            <RadioGroupItem value="sms" id="r-sms" />
            <Label for="r-sms" class="text-sm font-normal">SMS</Label>
          </div>
        </RadioGroup>
      </div>

      <div class="flex flex-col gap-2">
        <Label>Volume ({sliderValue}%)</Label>
        <Slider type="single" bind:value={sliderValue} min={0} max={100} step={1} />
      </div>
    </div>

    <!-- Full form example -->
    <div class="flex flex-col gap-4 rounded-lg border p-6 md:col-span-2">
      <h3 class="text-sm font-medium text-muted-foreground">Combined Form Example</h3>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-2">
          <Label for="first-name">First name</Label>
          <Input id="first-name" placeholder="Jane" />
        </div>
        <div class="flex flex-col gap-2">
          <Label for="last-name">Last name</Label>
          <Input id="last-name" placeholder="Doe" />
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="bio">Bio</Label>
        <Textarea id="bio" placeholder="Tell us about yourself..." />
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Save Changes</Button>
      </div>
    </div>
  </div>
</Section>
