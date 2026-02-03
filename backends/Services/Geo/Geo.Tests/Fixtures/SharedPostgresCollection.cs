// -----------------------------------------------------------------------
// <copyright file="SharedPostgresCollection.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Fixtures;

using Xunit;

/// <summary>
/// Collection definition for tests that can safely share a PostgreSQL container.
/// Tests in this collection use unique/generated data and don't depend on seed data counts.
/// </summary>
[CollectionDefinition("SharedPostgres")]
public class SharedPostgresCollection : ICollectionFixture<SharedPostgresFixture>;
