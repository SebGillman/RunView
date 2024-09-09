export type Config = {
  [key: string]: string;
};

export interface Activity {
  resource_state: number;
  athlete: {
    id: number;
    resource_state: number;
  };
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  workout_type: number;
  id: number;
  start_date: string;
  start_date_local: string;
  timezone: string;
  utc_offset: number;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map: {
    id: string;
    summary_polyline: string;
    resource_state: number;
  };
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  visibility: string;
  flagged: boolean;
  gear_id: string;
  start_latlng: [number, number];
  end_latlng: [number, number];
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
  heartrate_opt_out: boolean;
  display_hide_heartrate_option: boolean;
  elev_high: number;
  elev_low: number;
  upload_id: number;
  upload_id_str: string;
  external_id: string;
  from_accepted_tag: boolean;
  pr_count: number;
  total_photo_count: number;
  has_kudoed: boolean;
  description?: string;
}

export interface Club {
  id: number;
  resource_state: number;
  name: string;
  profile_medium: string;
  profile: string;
  cover_photo: string;
  cover_photo_small: string;
  activity_types: string[];
  activity_types_icon: string;
  dimensions: string[];
  sport_type: string;
  localized_sport_type: string;
  city: string;
  state: string;
  country: string;
  private: boolean;
  member_count: number;
  featured: boolean;
  verified: boolean;
  url: string;
  membership: string;
  admin: boolean;
  owner: boolean;
}

export interface Shoe {
  id: string;
  primary: boolean;
  name: string;
  nickname?: string;
  resource_state: number;
  retired: boolean;
  distance: number;
  converted_distance: number;
}

export interface Athlete {
  id: number;
  username: string;
  resource_state: number;
  firstname: string;
  lastname: string;
  bio: string;
  city?: string;
  state?: string;
  country?: string;
  sex: string;
  premium: boolean;
  summit: boolean;
  created_at: string;
  updated_at: string;
  badge_type_id: number;
  weight: number;
  profile_medium: string;
  profile: string;
  friend?: boolean;
  follower?: boolean;
  blocked: boolean;
  can_follow: boolean;
  follower_count: number;
  friend_count: number;
  mutual_friend_count: number;
  athlete_type: number;
  date_preference: string;
  measurement_preference: string;
  clubs: Club[];
  postable_clubs_count: number;
  ftp?: any;
  bikes: any[];
  shoes: Shoe[];
  is_winback_via_upload: boolean;
  is_winback_via_view: boolean;
}

export interface ChartJsonData {
  title: string;
  xlabel: string;
  ylabel: string;
  data: string;
}

export interface ChartData {
  title: string;
  xlabel: string;
  ylabel: string;
  data_labels: string[];
  data_values: number[];
}

export interface WeightMatchData {
  weight: number;
  unit: string;
  reps: number;
}

export interface WebHookRequest {
  aspect_type: "create" | "update" | "delete";
  event_time: number;
  object_id: number;
  object_type: "athlete" | "activity";
  owner_id: number;
  subscription_id: number;
  updates: {
    title?: string;
    type?: string;
    private?: boolean;
    authorized?: boolean;
  };
}

export interface TableName {
  name: string;
}
