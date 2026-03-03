<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
</script>

<div class="space-y-6">
  <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Card.Card>
      <Card.CardHeader>
        <Card.CardTitle>Overview</Card.CardTitle>
        <Card.CardDescription>Summary of your account activity.</Card.CardDescription>
      </Card.CardHeader>
      <Card.CardContent>
        <p class="text-muted-foreground text-sm">Dashboard content will be built in Step 10.</p>
      </Card.CardContent>
    </Card.Card>

    <Card.Card>
      <Card.CardHeader>
        <Card.CardTitle>Recent Activity</Card.CardTitle>
        <Card.CardDescription>Latest events in your organization.</Card.CardDescription>
      </Card.CardHeader>
      <Card.CardContent>
        <p class="text-muted-foreground text-sm">Activity feed placeholder.</p>
      </Card.CardContent>
    </Card.Card>

    <Card.Card>
      <Card.CardHeader>
        <Card.CardTitle>Quick Actions</Card.CardTitle>
        <Card.CardDescription>Frequently used operations.</Card.CardDescription>
      </Card.CardHeader>
      <Card.CardContent>
        <p class="text-muted-foreground text-sm">Quick actions placeholder.</p>
      </Card.CardContent>
    </Card.Card>
  </div>
</div>
