// -----------------------------------------------------------------------
// <copyright file="I18nCollection.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.I18n;

using System.Diagnostics.CodeAnalysis;

/// <summary>
/// xUnit collection definition that serialises all i18n test classes.
/// Required because <see cref="D2.Shared.I18n.SupportedLocales"/> is a static class
/// with mutable state — parallel test classes mutating it would cause race conditions.
/// </summary>
[CollectionDefinition("I18n")]
[SuppressMessage("Naming", "CA1711:Identifiers should not have incorrect suffix", Justification = "xUnit collection definition convention requires 'Collection' suffix.")]
public class I18NCollection;
