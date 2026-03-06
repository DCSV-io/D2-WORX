<script lang="ts">
  import * as Card from "$lib/client/components/ui/card/index.js";
  import { Button } from "$lib/client/components/ui/button/index.js";
</script>

<Card.Card>
  <Card.CardHeader class="text-center">
    <Card.CardTitle class="text-2xl">Welcome to DCSV WORX</Card.CardTitle>
    <Card.CardDescription>
      Let's get you set up. Choose an existing organization to join or create a new one.
    </Card.CardDescription>
  </Card.CardHeader>
  <Card.CardContent>
    <p class="text-muted-foreground text-center text-sm">
      Organization selection will be wired in Step 8 (Onboarding flow).
    </p>
  </Card.CardContent>
  <Card.CardFooter class="justify-center">
    <Button disabled>Create Organization</Button>
  </Card.CardFooter>
</Card.Card>
