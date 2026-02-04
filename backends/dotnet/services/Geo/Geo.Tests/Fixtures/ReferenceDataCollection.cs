// -----------------------------------------------------------------------
// <copyright file="ReferenceDataCollection.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Fixtures;

using Xunit;

/// <summary>
/// Collection definition for tests that depend on pristine reference/seed data.
/// Tests in this collection assert on specific counts (249 countries, 183 subdivisions, etc.).
/// </summary>
[CollectionDefinition("ReferenceData")]
public class ReferenceDataCollection : ICollectionFixture<SharedPostgresFixture>;
