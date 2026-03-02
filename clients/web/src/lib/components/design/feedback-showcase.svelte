<script lang="ts">
  import Section from "./section.svelte";
  import { Progress } from "$lib/components/ui/progress/index.js";
  import { Skeleton } from "$lib/components/ui/skeleton/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { toast } from "svelte-sonner";
</script>

<Section id="feedback" title="Feedback">
  <div class="grid gap-6 md:grid-cols-2">
    <!-- Progress -->
    <div class="flex flex-col gap-4 rounded-lg border p-6">
      <h3 class="text-sm font-medium text-muted-foreground">Progress Bars</h3>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-muted-foreground">25%</span>
          <Progress value={25} />
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-muted-foreground">50%</span>
          <Progress value={50} />
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-muted-foreground">75%</span>
          <Progress value={75} />
        </div>
        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-muted-foreground">100%</span>
          <Progress value={100} />
        </div>
      </div>
    </div>

    <!-- Skeleton -->
    <div class="flex flex-col gap-4 rounded-lg border p-6">
      <h3 class="text-sm font-medium text-muted-foreground">Skeleton Loaders</h3>
      <div class="flex flex-col gap-4">
        <!-- Card skeleton -->
        <div class="flex items-center gap-4">
          <Skeleton class="size-12 rounded-full" />
          <div class="flex flex-col gap-2">
            <Skeleton class="h-4 w-48" />
            <Skeleton class="h-3 w-32" />
          </div>
        </div>
        <!-- Content skeleton -->
        <div class="flex flex-col gap-2">
          <Skeleton class="h-4 w-full" />
          <Skeleton class="h-4 w-4/5" />
          <Skeleton class="h-4 w-3/5" />
        </div>
        <!-- Button skeleton -->
        <div class="flex gap-2">
          <Skeleton class="h-9 w-24" />
          <Skeleton class="h-9 w-24" />
        </div>
      </div>
    </div>

    <!-- Toasts -->
    <div class="flex flex-col gap-4 rounded-lg border p-6 md:col-span-2">
      <h3 class="text-sm font-medium text-muted-foreground">Toast Notifications</h3>
      <div class="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onclick={() => toast("Event has been created")}
        >
          Default Toast
        </Button>
        <Button
          variant="outline"
          onclick={() => toast.success("Successfully saved!")}
        >
          Success Toast
        </Button>
        <Button
          variant="outline"
          onclick={() => toast.error("Something went wrong")}
        >
          Error Toast
        </Button>
        <Button
          variant="outline"
          onclick={() => toast.warning("Please review before continuing")}
        >
          Warning Toast
        </Button>
        <Button
          variant="outline"
          onclick={() => toast.info("New version available")}
        >
          Info Toast
        </Button>
        <Button
          variant="outline"
          onclick={() =>
            toast("Event created", { description: "Monday, January 3rd at 6:00pm" })
          }
        >
          With Description
        </Button>
      </div>
    </div>
  </div>
</Section>
