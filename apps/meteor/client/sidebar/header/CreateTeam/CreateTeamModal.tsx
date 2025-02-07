import {
	Box,
	Button,
	Field,
	Icon,
	Modal,
	TextInput,
	ToggleSwitch,
	FieldGroup,
	FieldLabel,
	FieldRow,
	FieldError,
	FieldDescription,
} from '@rocket.chat/fuselage';
import { useUniqueId } from '@rocket.chat/fuselage-hooks';
import {
	useEndpoint,
	usePermission,
	usePermissionWithScopedRoles,
	useSetting,
	useToastMessageDispatch,
	useTranslation,
} from '@rocket.chat/ui-contexts';
import type { ComponentProps, ReactElement } from 'react';
import React, { memo, useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';

import UserAutoCompleteMultiple from '../../../components/UserAutoCompleteMultiple';
import { goToRoomById } from '../../../lib/utils/goToRoomById';

type CreateTeamModalInputs = {
	name: string;
	topic: string;
	isPrivate: boolean;
	readOnly: boolean;
	encrypted: boolean;
	broadcast: boolean;
	members?: string[];
};

const CreateTeamModal = ({ onClose }: { onClose: () => void }): ReactElement => {
	const t = useTranslation();
	const e2eEnabled = useSetting('E2E_Enable');
	const e2eEnabledForPrivateByDefault = useSetting('E2E_Enabled_Default_PrivateRooms');
	const namesValidation = useSetting('UTF8_Channel_Names_Validation');
	const allowSpecialNames = useSetting('UI_Allow_room_names_with_special_chars');
	const dispatchToastMessage = useToastMessageDispatch();
	const canCreateTeam = usePermission('create-team');
	const canSetReadOnly = usePermissionWithScopedRoles('set-readonly', ['owner']);

	const checkTeamNameExists = useEndpoint('GET', '/v1/rooms.nameExists');
	const createTeamAction = useEndpoint('POST', '/v1/teams.create');

	const teamNameRegex = useMemo(() => {
		if (allowSpecialNames) {
			return null;
		}

		return new RegExp(`^${namesValidation}$`);
	}, [allowSpecialNames, namesValidation]);

	const validateTeamName = async (name: string): Promise<string | undefined> => {
		if (!name) {
			return;
		}

		if (teamNameRegex && !teamNameRegex?.test(name)) {
			return t('Teams_Errors_team_name', { name });
		}

		const { exists } = await checkTeamNameExists({ roomName: name });
		if (exists) {
			return t('Teams_Errors_Already_exists', { name });
		}
	};

	const {
		register,
		control,
		handleSubmit,
		setValue,
		watch,
		formState: { isDirty, errors },
	} = useForm<CreateTeamModalInputs>({
		defaultValues: {
			isPrivate: true,
			readOnly: false,
			encrypted: (e2eEnabledForPrivateByDefault as boolean) ?? false,
			broadcast: false,
			members: [],
		},
	});

	const { isPrivate, broadcast, readOnly } = watch();

	useEffect(() => {
		if (!isPrivate) {
			setValue('encrypted', false);
		}

		if (broadcast) {
			setValue('encrypted', false);
		}

		setValue('readOnly', broadcast);
	}, [watch, setValue, broadcast, isPrivate]);

	const canChangeReadOnly = !broadcast;
	const canChangeEncrypted = isPrivate && !broadcast && e2eEnabled && !e2eEnabledForPrivateByDefault;
	const isButtonEnabled = isDirty && canCreateTeam;

	const handleCreateTeam = async ({
		name,
		members,
		isPrivate,
		readOnly,
		topic,
		broadcast,
		encrypted,
	}: CreateTeamModalInputs): Promise<void> => {
		const params = {
			name,
			members,
			type: isPrivate ? 1 : 0,
			room: {
				readOnly,
				extraData: {
					topic,
					broadcast,
					encrypted,
				},
			},
		};

		try {
			const { team } = await createTeamAction(params);
			dispatchToastMessage({ type: 'success', message: t('Team_has_been_created') });
			goToRoomById(team.roomId);
		} catch (error) {
			dispatchToastMessage({ type: 'error', message: error });
		} finally {
			onClose();
		}
	};

	const createTeamFormId = useUniqueId();
	const nameId = useUniqueId();
	const topicId = useUniqueId();
	const privateId = useUniqueId();
	const readOnlyId = useUniqueId();
	const encryptedId = useUniqueId();
	const broadcastId = useUniqueId();
	const addMembersId = useUniqueId();

	return (
		<Modal
			aria-labelledby={`${createTeamFormId}-title`}
			wrapperFunction={(props: ComponentProps<typeof Box>) => (
				<Box is='form' id={createTeamFormId} onSubmit={handleSubmit(handleCreateTeam)} {...props} />
			)}
		>
			<Modal.Header>
				<Modal.Title id={`${createTeamFormId}-title`}>{t('Teams_New_Title')}</Modal.Title>
				<Modal.Close title={t('Close')} onClick={onClose} tabIndex={-1} />
			</Modal.Header>
			<Modal.Content mbe={2}>
				<FieldGroup>
					<Field>
						<FieldLabel required htmlFor={nameId}>
							{t('Teams_New_Name_Label')}
						</FieldLabel>
						<FieldRow>
							<TextInput
								id={nameId}
								aria-invalid={errors.name ? 'true' : 'false'}
								{...register('name', {
									required: t('error-the-field-is-required', { field: t('Name') }),
									validate: (value) => validateTeamName(value),
								})}
								placeholder={t('Team_Name')}
								addon={<Icon size='x20' name={isPrivate ? 'team-lock' : 'team'} />}
								error={errors.name?.message}
								aria-describedby={`${nameId}-error`}
								aria-required='true'
							/>
						</FieldRow>
						{errors?.name && (
							<FieldError aria-live='assertive' id={`${nameId}-error`}>
								{errors.name.message}
							</FieldError>
						)}
					</Field>
					<Field>
						<FieldLabel htmlFor={topicId}>
							{t('Teams_New_Description_Label')}{' '}
							<Box is='span' color='annotation'>
								({t('optional')})
							</Box>
						</FieldLabel>
						<FieldRow>
							<TextInput
								id={topicId}
								aria-describedby={`${topicId}-hint`}
								{...register('topic')}
								placeholder={t('Teams_New_Description_Placeholder')}
							/>
						</FieldRow>
					</Field>
					<Field>
						<Box display='flex' justifyContent='space-between' alignItems='start'>
							<Box display='flex' flexDirection='column' width='full'>
								<FieldLabel htmlFor={privateId}>{t('Teams_New_Private_Label')}</FieldLabel>
								<FieldDescription id={`${privateId}-hint`}>
									{isPrivate ? t('Teams_New_Private_Description_Enabled') : t('Teams_New_Private_Description_Disabled')}
								</FieldDescription>
							</Box>
							<Controller
								control={control}
								name='isPrivate'
								render={({ field: { onChange, value, ref } }): ReactElement => (
									<ToggleSwitch id={privateId} aria-describedby={`${privateId}-hint`} onChange={onChange} checked={value} ref={ref} />
								)}
							/>
						</Box>
					</Field>
					<Field>
						<Box display='flex' justifyContent='space-between' alignItems='start'>
							<Box display='flex' flexDirection='column' width='full'>
								<FieldLabel htmlFor={readOnlyId}>{t('Teams_New_Read_only_Label')}</FieldLabel>
								<FieldDescription id={`${readOnlyId}-hint`}>
									{readOnly ? t('Only_authorized_users_can_write_new_messages') : t('Teams_New_Read_only_Description')}
								</FieldDescription>
							</Box>
							<Controller
								control={control}
								name='readOnly'
								render={({ field: { onChange, value, ref } }): ReactElement => (
									<ToggleSwitch
										id={readOnlyId}
										aria-describedby={`${readOnlyId}-hint`}
										disabled={!canChangeReadOnly}
										onChange={onChange}
										checked={value}
										ref={ref}
									/>
								)}
							/>
						</Box>
					</Field>
					<Field>
						<Box display='flex' justifyContent='space-between' alignItems='start'>
							<Box display='flex' flexDirection='column' width='full'>
								<FieldLabel htmlFor={encryptedId}>{t('Teams_New_Encrypted_Label')}</FieldLabel>
								<FieldDescription id={`${encryptedId}-hint`}>
									{isPrivate ? t('Teams_New_Encrypted_Description_Enabled') : t('Teams_New_Encrypted_Description_Disabled')}
								</FieldDescription>
							</Box>
							<Controller
								control={control}
								name='encrypted'
								render={({ field: { onChange, value, ref } }): ReactElement => (
									<ToggleSwitch
										id={encryptedId}
										disabled={!canSetReadOnly || !canChangeEncrypted}
										onChange={onChange}
										aria-describedby={`${encryptedId}-hint`}
										checked={value}
										ref={ref}
									/>
								)}
							/>
						</Box>
					</Field>
					<Field>
						<Box display='flex' justifyContent='space-between' alignItems='start'>
							<Box display='flex' flexDirection='column' width='full'>
								<FieldLabel htmlFor={broadcastId}>{t('Teams_New_Broadcast_Label')}</FieldLabel>
								<FieldDescription d={`${broadcastId}-hint`}>{t('Teams_New_Broadcast_Description')}</FieldDescription>
							</Box>
							<Controller
								control={control}
								name='broadcast'
								render={({ field: { onChange, value, ref } }): ReactElement => (
									<ToggleSwitch aria-describedby={`${broadcastId}-hint`} id={broadcastId} onChange={onChange} checked={value} ref={ref} />
								)}
							/>
						</Box>
					</Field>
					<Field>
						<FieldLabel htmlFor={addMembersId}>
							{t('Teams_New_Add_members_Label')}{' '}
							<Box is='span' color='annotation'>
								({t('optional')})
							</Box>
						</FieldLabel>
						<Controller
							control={control}
							name='members'
							render={({ field: { onChange, value } }): ReactElement => <UserAutoCompleteMultiple value={value} onChange={onChange} />}
						/>
					</Field>
				</FieldGroup>
			</Modal.Content>
			<Modal.Footer>
				<Modal.FooterControllers>
					<Button onClick={onClose}>{t('Cancel')}</Button>
					<Button disabled={!isButtonEnabled} type='submit' primary>
						{t('Create')}
					</Button>
				</Modal.FooterControllers>
			</Modal.Footer>
		</Modal>
	);
};

export default memo(CreateTeamModal);
