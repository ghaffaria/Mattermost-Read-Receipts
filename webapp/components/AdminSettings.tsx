import React, { FC, ChangeEvent, ReactElement, useEffect, useState } from 'react';

const AdminSettings: FC = (): ReactElement => {
    const [enableReadReceipts, setEnableReadReceipts] = useState(false);
    const [enableLogging, setEnableLogging] = useState(false);

    // Fetch current settings from the backend.
    useEffect(() => {
        fetch('/plugins/mattermost-readreceipts/api/v1/settings')
            .then((response) => response.json())
            .then((data) => {
                setEnableReadReceipts(data.enableReadReceipts);
                setEnableLogging(data.enableLogging);
            })
            .catch((error) => {
                console.error('Failed to fetch settings:', error);
            });
    }, []);

    // Update settings on the backend.
    const updateSetting = (key: string, value: boolean) => {
        fetch(`/plugins/mattermost-readreceipts/api/v1/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ [key]: value }),
        }).catch((error) => {
            console.error('Failed to update setting:', error);
        });
    };

    const handleEnableReceipts = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.checked;
        setEnableReadReceipts(value);
        updateSetting('enableReadReceipts', value);
    };

    const handleEnableLogging = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.checked;
        setEnableLogging(value);
        updateSetting('enableLogging', value);
    };

    return (
        <div className="admin-settings">
            <h3>Read Receipts Plugin Settings</h3>

            <div className="setting">
                <label>
                    <input
                        type="checkbox"
                        checked={enableReadReceipts}
                        onChange={handleEnableReceipts}
                    />
                    Enable Read Receipts
                </label>
            </div>

            <div className="setting">
                <label>
                    <input
                        type="checkbox"
                        checked={enableLogging}
                        onChange={handleEnableLogging}
                    />
                    Enable Logging
                </label>
            </div>

            <style>{`
                .admin-settings {
                    padding: 20px;
                }

                .setting {
                    margin-bottom: 15px;
                }

                label {
                    font-size: 16px;
                }
            `}</style>
        </div>
    );
};

export default AdminSettings;
