// -----------------------------------------------------------------------
// <copyright file="Constants.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Utilities.Constants;

/// <summary>
/// A static class containing commonly used constant values.
/// </summary>
public static class Constants
{
    #region Distributed Cache Keys

    /// <summary>
    /// The prefix for distributed cache keys.
    /// </summary>
    public const string DIST_CACHE_KEY_PREFIX = "d2:";

    /// <summary>
    /// The distributed cache key for geo data.
    /// </summary>
    public const string DIST_CACHE_KEY_GEO = DIST_CACHE_KEY_PREFIX + "geo:";

    /// <summary>
    /// The distributed cache key for georeference data.
    /// </summary>
    public const string DIST_CACHE_KEY_GEO_REF_DATA = DIST_CACHE_KEY_GEO + "refdata";

    #endregion

    #region Other / Misc

    /// <summary>
    /// The configuration key for the local files' path.
    /// </summary>
    public const string LOCAL_FILES_PATH_CONFIG_KEY = "LocalFilesPath";

    /// <summary>
    /// The file name for georeference data stored on disk.
    /// </summary>
    public const string GEO_REF_DATA_FILE_NAME = "georefdata.bin";

    #endregion
}
