import React, { FC, ReactElement } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface PostReceiptProps {
    messageId: string;
}

const PostReceipt: FC<PostReceiptProps> = ({ messageId }): ReactElement => {
    const seenBy = useSelector((state: RootState) => state.readReceipts.receipts[messageId] || []);

    return (
        <div className="post-receipt">
            <span className="tick-icon">✔</span>

            {seenBy.length > 0 && (
                <div className="tooltip">
                    Seen by: {seenBy.join(', ')}
                </div>
            )}

            <style>{`
                .post-receipt {
                    position: relative;
                    display: inline-block;
                    margin-left: 8px;
                }

                .tick-icon {
                    color: green;
                    cursor: pointer;
                }

                .tooltip {
                    visibility: hidden;
                    background-color: #555;
                    color: #fff;
                    text-align: center;
                    border-radius: 5px;
                    padding: 5px;
                    position: absolute;
                    z-index: 1;
                    bottom: 125%;
                    left: 50%;
                    transform: translateX(-50%);
                    opacity: 0;
                    transition: opacity 0.3s;
                }

                .post-receipt:hover .tooltip {
                    visibility: visible;
                    opacity: 1;
                }
            `}</style>
        </div>
    );
};

export default PostReceipt;
