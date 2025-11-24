// -----------------------------------------------------------------------
// <copyright file="IRepository.CommitTx.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Interfaces.Repository;

using D2.Contracts.Handler;

public partial interface IRepository
{
    /// <summary>
    /// Handler for committing a database transaction.
    /// </summary>
    public interface ICommitTxHandler : IHandler<CommitTxInput, CommitTxOutput>;

    /// <summary>
    /// Input for committing a database transaction.
    /// </summary>
    public record CommitTxInput;

    /// <summary>
    /// Output for committing a database transaction.
    /// </summary>
    public record CommitTxOutput;
}
