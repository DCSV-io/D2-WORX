// -----------------------------------------------------------------------
// <copyright file="IRepository.RollbackTx.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Interfaces.Repository;

using D2.Contracts.Handler;

public partial interface IRepository
{
    /// <summary>
    /// Handler for rolling back a database transaction.
    /// </summary>
    public interface IRollbackTxHandler : IHandler<RollbackTxInput, RollbackTxOutput>;

    /// <summary>
    /// Input for rolling back a database transaction.
    /// </summary>
    public record RollbackTxInput;

    /// <summary>
    /// Output for rolling back a database transaction.
    /// </summary>
    public record RollbackTxOutput;
}
