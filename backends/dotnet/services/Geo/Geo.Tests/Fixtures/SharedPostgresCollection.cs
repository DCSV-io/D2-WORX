// -----------------------------------------------------------------------
// <copyright file="SharedPostgresCollection.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Fixtures;

using System.Diagnostics.CodeAnalysis;
using Xunit;

/// <summary>
/// Collection definition for tests that can safely share a PostgreSQL container.
/// Tests in this collection use unique/generated data and don't depend on seed data counts.
/// </summary>
[CollectionDefinition("SharedPostgres")]
[SuppressMessage("Naming", "CA1711:Identifiers should not have incorrect suffix", Justification = "xUnit collection definition convention requires 'Collection' suffix.")]
public class SharedPostgresCollection : ICollectionFixture<SharedPostgresFixture>;
